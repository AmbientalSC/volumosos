import React, { useState, useRef, useEffect } from 'react';
import { db, storage, auth, signInAnonymouslyAsync, checkAuthState } from './firebase';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { PhotoRecord, PendingRecord } from './types';
import { CameraIcon, LocationMarkerIcon, CalendarIcon, ImageIcon, CloudUploadIcon, XIcon } from './components/Icons';
import Spinner from './components/Spinner';
import Modal from './components/Modal';

// Helper to format date and time
const formatDateTime = (date: Date) => {
  return {
    date: date.toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    time: date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
};

const App: React.FC = () => {
  const [records, setRecords] = useState<PhotoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManualAddressModalOpen, setIsManualAddressModalOpen] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<PhotoRecord | null>(null);

    const [pendingRecord, setPendingRecord] = useState<{ base64: string; timestamp: Date } | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([]);

  const fileInputCameraRef = useRef<HTMLInputElement>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);

  // Autenticação anônima
  useEffect(() => {
    const authenticateUser = async () => {
      try {
        console.log("Iniciando autenticação anônima...");
        const user = await signInAnonymouslyAsync();
        console.log("Usuário autenticado com sucesso:", user.uid);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Erro na autenticação:", error);
        setError("Erro ao conectar com o Firebase. Verifique sua conexão.");
      }
    };

    // Verificar estado de autenticação
    const unsubscribe = checkAuthState((user) => {
      if (user) {
        console.log("Verificação de estado: Usuário autenticado", user.uid);
        setIsAuthenticated(true);
      } else {
        console.log("Verificação de estado: Usuário não autenticado");
        setIsAuthenticated(false);
      }
    });

    authenticateUser();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      console.log("Usuário não autenticado ainda, aguardando...");
      return;
    }
    
    console.log("Usuário autenticado, carregando registros...");
    setIsLoading(true);
    const q = query(collection(db, "records"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        console.log("Registros carregados com sucesso:", querySnapshot.size, "documentos");
        const recordsData: PhotoRecord[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            recordsData.push({
                id: doc.id,
                address: data.address,
                imageUrl: data.imageUrl,
                timestamp: (data.timestamp as Timestamp).toDate(),
            });
        });
        setRecords(recordsData);
        setIsLoading(false);
      }, 
      (error) => {
        console.error("Error fetching records:", error);
        console.error("Código do erro:", error.code);
        console.error("Mensagem do erro:", error.message);
        setError("Não foi possível carregar os registros. Verifique sua conexão e as permissões do Firebase.");
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [isAuthenticated]);

  // Carregar registros pendentes do localStorage
  useEffect(() => {
    const stored = localStorage.getItem('pendingRecords');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPendingRecords(parsed.map((p: any) => ({ ...p, timestamp: new Date(p.timestamp) })));
      } catch (e) {
        console.error('Erro ao carregar registros pendentes:', e);
      }
    }
  }, []);

  // Salvar registros pendentes no localStorage
  useEffect(() => {
    localStorage.setItem('pendingRecords', JSON.stringify(pendingRecords));
  }, [pendingRecords]);

  // Sincronização automática quando online ou quando há pendentes
  useEffect(() => {
    if (!isSyncingRef.current && pendingRecords.length > 0 && navigator.onLine && isAuthenticated) {
      isSyncingRef.current = true;
      syncPendingRecords().finally(() => {
        isSyncingRef.current = false;
      });
    }
  }, [isAuthenticated, pendingRecords.length]);

  // Listener para quando volta online
  useEffect(() => {
    const handleOnline = () => {
      console.log('Conexão detectada, tentando sincronizar registros pendentes...');
      if (!isSyncingRef.current && pendingRecords.length > 0 && isAuthenticated) {
        isSyncingRef.current = true;
        syncPendingRecords().finally(() => {
          isSyncingRef.current = false;
        });
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isAuthenticated, pendingRecords.length]);

  const saveRecord = async (base64: string, address: string, timestamp: Date) => {
    setIsSubmitting(true);
    setError(null);
    try {
      console.log("Iniciando upload da imagem...");
      const blob = fromBase64(base64);
      const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
      const imageRef = ref(storage, `images/${uuidv4()}-${file.name}`);
      const snapshot = await uploadBytes(imageRef, file);
      console.log("Imagem enviada com sucesso");
      const imageUrl = await getDownloadURL(snapshot.ref);
      console.log("URL da imagem obtida:", imageUrl);

      console.log("Salvando registro no Firestore...");
      await addDoc(collection(db, "records"), {
        imageUrl,
        address,
        timestamp: Timestamp.fromDate(timestamp),
      });
      console.log("Registro salvo com sucesso no Firestore");
    } catch (err) {
      console.error("Error saving record:", err);
      console.error("Código do erro:", (err as any).code);
      console.error("Mensagem do erro:", (err as any).message);
      setError("Falha ao salvar o registro. Armazenado localmente para sincronização posterior.");
      throw err; // Re-throw para capturar no caller
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchAddress = async (latitude: number, longitude: number): Promise<string> => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=pt-BR`
    );
    if (!response.ok) throw new Error('Falha ao buscar endereço a partir das coordenadas.');
    const data = await response.json();
    
    // Usar campos estruturados do address para melhor precisão
    const addr = data.address || {};
    const rua = addr.road || addr.pedestrian || addr.path || addr.cycleway || '';
    const numero = addr.house_number || '';
    const bairro = addr.suburb || addr.neighbourhood || addr.village || '';
    const referencia = addr.amenity || addr.shop || addr.office || addr.building || '';
    
    // Montar endereço priorizando rua, número, bairro, referência
    const parts = [];
    if (rua) parts.push(rua);
    if (numero) parts.push(numero);
    if (bairro) parts.push(bairro);
    if (referencia) parts.push(`(${referencia})`);
    
    const fullAddress = parts.join(', ') || data.display_name || 'Endereço não encontrado.';
    return simplifyAddress(fullAddress);
  };

  const simplifyAddress = (fullAddress: string): string => {
    // Como agora usamos campos estruturados, o endereço já está simplificado
    // Apenas remover duplicatas ou ajustar se necessário
    return fullAddress;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    setError(null);
    setGeoError(null);

    const resetInputs = () => {
        if (fileInputCameraRef.current) fileInputCameraRef.current.value = "";
        if (fileInputGalleryRef.current) fileInputGalleryRef.current.value = "";
    };

    const timestamp = new Date();
    try {
      const base64 = await toBase64(file);
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true, timeout: 8000, maximumAge: 0,
          });
      });
      const { latitude, longitude } = position.coords;
      const address = await fetchAddress(latitude, longitude);
      try {
        await saveRecord(base64, address, timestamp);
      } catch (uploadErr) {
        console.error('Upload falhou, armazenando localmente:', uploadErr);
        setPendingRecords(prev => [...prev, { base64, address, timestamp }]);
        setError("Registro armazenado localmente devido a falha de conexão. Será sincronizado quando houver rede.");
      }
    } catch (geoErr) {
        let message = 'Erro de localização desconhecido.';
        if (geoErr instanceof GeolocationPositionError) {
          switch (geoErr.code) {
            case geoErr.PERMISSION_DENIED:
              message = "Acesso à localização negado. Por favor, habilite a permissão no seu navegador/dispositivo."; break;
            case geoErr.POSITION_UNAVAILABLE:
              message = "Informações de localização indisponíveis no momento."; break;
            case geoErr.TIMEOUT:
              message = "A requisição de localização expirou. Verifique seu sinal de GPS."; break;
          }
        } else if (geoErr instanceof Error) {
            message = geoErr.message;
        }
        console.error("Geolocation failed:", geoErr);
        setGeoError(message);
        try {
          const base64 = await toBase64(file);
          setPendingRecord({ base64, timestamp });
        } catch (base64Err) {
          console.error("Erro ao converter para base64:", base64Err);
          setError("Erro ao processar a imagem.");
        }
        setIsManualAddressModalOpen(true);
    } finally {
        setIsSubmitting(false);
        resetInputs();
    }
  };

  const handleTakePhoto = () => { setIsModalOpen(false); fileInputCameraRef.current?.click(); };
  const handleChooseFromGallery = () => { setIsModalOpen(false); fileInputGalleryRef.current?.click(); };

  const fetchAddressSuggestions = async (query: string) => {
      if (query.length < 3) { setAddressSuggestions([]); return; }
      setIsGeocoding(true);
      try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&accept-language=pt-BR&limit=5`);
          if (!response.ok) throw new Error('Falha na busca de endereço.');
          const suggestions = await response.json();
          
          // Simplificar as sugestões
          const simplifiedSuggestions = suggestions.map((suggestion: any) => ({
              ...suggestion,
              display_name: simplifyAddress(suggestion.display_name)
          }));
          
          setAddressSuggestions(simplifiedSuggestions);
      } catch (err) { console.error(err); setAddressSuggestions([]); } 
      finally { setIsGeocoding(false); }
  };

  const handleManualAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setManualAddress(query);
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = window.setTimeout(() => { fetchAddressSuggestions(query); }, 500);
  };
  
  const handleSelectSuggestion = (address: string) => { setManualAddress(address); setAddressSuggestions([]); };

  const handleManualAddressSubmit = async () => {
    if (!pendingRecord || !manualAddress) return;
    setIsManualAddressModalOpen(false);
    try {
      await saveRecord(pendingRecord.base64, manualAddress, pendingRecord.timestamp);
    } catch (err) {
      // Se falhar, adicionar aos pendentes
      setPendingRecords(prev => [...prev, { base64: pendingRecord.base64, address: manualAddress, timestamp: pendingRecord.timestamp }]);
      setError("Registro armazenado localmente devido a falha de conexão. Será sincronizado quando houver rede.");
    }
    setPendingRecord(null); setManualAddress(''); setAddressSuggestions([]); setGeoError(null);
  };

  const handleLongPress = (record: PhotoRecord) => {
    setRecordToDelete(record);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;
    
    setIsSubmitting(true);
    try {
      // Extrair o nome do arquivo da URL do Storage
      const imageUrl = recordToDelete.imageUrl;
      const imagePath = imageUrl.split('/o/')[1]?.split('?')[0];
      
      if (imagePath) {
        // Decodificar o caminho da URL
        const decodedPath = decodeURIComponent(imagePath);
        const imageRef = ref(storage, decodedPath);
        
        // Deletar a imagem do Storage
        await deleteObject(imageRef);
        console.log("Imagem deletada do Storage");
      }
      
      // Deletar o documento do Firestore
      await deleteDoc(doc(db, "records", recordToDelete.id));
      console.log("Registro deletado do Firestore");
      
      setIsDeleteModalOpen(false);
      setRecordToDelete(null);
    } catch (error) {
      console.error("Erro ao deletar registro:", error);
      setError("Falha ao deletar o registro. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateCSV = () => {
    let filteredRecords = records;
    if (startDate && endDate) {
      const start = new Date(startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(endDate); end.setHours(23, 59, 59, 999);
      filteredRecords = records.filter(r => r.timestamp >= start && r.timestamp <= end);
    }
    if (filteredRecords.length === 0) { alert("Nenhum registro encontrado para o período selecionado."); return; }
    
    // Cabeçalho: Data;Local;LINK PARA A IMAGEM
    const headers = ['Data', 'Local', 'LINK PARA A IMAGEM'];
    const rows = filteredRecords.map(record => {
        // Formatar data e hora: dd/mm/aaaa hh:mm
        const day = record.timestamp.getDate().toString().padStart(2, '0');
        const month = (record.timestamp.getMonth() + 1).toString().padStart(2, '0');
        const year = record.timestamp.getFullYear();
        const hours = record.timestamp.getHours().toString().padStart(2, '0');
        const minutes = record.timestamp.getMinutes().toString().padStart(2, '0');
        const dateTime = `${day}/${month}/${year} ${hours}:${minutes}`;
        
        const local = record.address.replace(/;/g, ','); // Evita quebrar coluna
        // Hiperlink Excel: =HYPERLINK("url";"Clique aqui")
        const link = `${record.imageUrl}`;
        return [dateTime, local, link].join(';');
    });
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = 'relatorio_fotos.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const fromBase64 = (base64: string): Blob => {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const syncPendingRecords = async () => {
    if (pendingRecords.length === 0 || !isAuthenticated) return;
    console.log(`Tentando sincronizar ${pendingRecords.length} registros pendentes...`);
    const remaining: PendingRecord[] = [];
    for (const record of pendingRecords) {
      try {
        await saveRecord(record.base64, record.address, record.timestamp);
        console.log('Registro pendente sincronizado com sucesso');
      } catch (err) {
        console.error('Falha ao sincronizar registro pendente:', err);
        remaining.push(record);
      }
    }
    setPendingRecords(remaining);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white shadow-md sticky top-0 z-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-teal-600 tracking-tight text-center mb-4">Controle de Volumosos - BC</h1>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full max-w-xl mx-auto">
            <div className="flex items-center gap-2">
              <label htmlFor="startDate" className="text-sm font-medium text-slate-600 flex-shrink-0">De:</label>
              <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm" aria-label="Data inicial do filtro"/>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="endDate" className="text-sm font-medium text-slate-600 flex-shrink-0">Até:</label>
              <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm" aria-label="Data final do filtro"/>
            </div>
            <button onClick={generateCSV} disabled={records.length === 0} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">Gerar Relatório</button>
          </div>
        </div>
      </header>
      
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Adicionar Registro">
        <div className="space-y-4">
          <button onClick={handleTakePhoto} className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-teal-500 text-white font-bold rounded-lg shadow-md hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75 transition-all"><CameraIcon className="h-6 w-6" /><span>Tirar Foto com a Câmera</span></button>
          <button onClick={handleChooseFromGallery} className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-indigo-500 text-white font-bold rounded-lg shadow-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75 transition-all"><ImageIcon className="h-6 w-6" /><span>Escolher da Galeria</span></button>
        </div>
      </Modal>

      <Modal isOpen={isManualAddressModalOpen} onClose={() => { setIsManualAddressModalOpen(false); setPendingRecord(null); setManualAddress(''); setAddressSuggestions([]); setGeoError(null); }} title="Endereço não encontrado">
        <div className="space-y-4">
          <p className="text-sm text-red-600 bg-red-100 p-3 rounded-lg">{geoError || "Não foi possível obter sua localização. Por favor, digite o endereço manualmente."}</p>
          <div className="relative">
            <input type="text" placeholder="Digite o endereço para buscar..." value={manualAddress} onChange={handleManualAddressChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" aria-label="Entrada de endereço manual"/>
            {isGeocoding && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-t-2 border-teal-500"></div></div>}
            {addressSuggestions.length > 0 && <ul className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">{addressSuggestions.map((s) => (<li key={s.place_id}><button onClick={() => handleSelectSuggestion(s.display_name)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-teal-50 transition-colors">{s.display_name}</button></li>))}</ul>}
          </div>
          <button onClick={handleManualAddressSubmit} disabled={!manualAddress.trim() || isSubmitting} className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-teal-500 text-white font-bold rounded-lg shadow-md hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75 disabled:bg-teal-300 disabled:cursor-not-allowed transition-colors"><CloudUploadIcon className="h-6 w-6" /><span>{isSubmitting ? 'Enviando...' : 'Confirmar e Salvar'}</span></button>
        </div>
      </Modal>

      {viewingImage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center" onClick={() => setViewingImage(null)}>
          <button onClick={() => setViewingImage(null)} className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"><XIcon className="h-10 w-10" /></button>
          <img 
            src={viewingImage} 
            alt="Visualização ampliada" 
            className="bg-white rounded-lg shadow-lg border border-slate-200 object-contain p-2
              w-[90vw] h-auto max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl
              max-h-[60vh] sm:max-h-[70vh] md:max-h-[80vh]"
            style={{
              boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
              border: '1px solid #e2e8f0',
            }}
          />
        </div>
      )}

      <Modal isOpen={isDeleteModalOpen} onClose={() => { setIsDeleteModalOpen(false); setRecordToDelete(null); }} title="Confirmar Exclusão">
        <div className="space-y-4">
          <p className="text-sm text-red-600 bg-red-100 p-3 rounded-lg">
            Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button 
              onClick={() => { setIsDeleteModalOpen(false); setRecordToDelete(null); }} 
              className="flex-1 px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleDeleteRecord} 
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </Modal>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-slate-200">
          <h2 className="text-xl font-semibold mb-4 text-center">Adicionar um Novo Registro</h2>
          <div className="flex justify-center">
              <button onClick={() => setIsModalOpen(true)} disabled={isSubmitting} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-teal-500 text-white font-bold rounded-lg shadow-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75 disabled:bg-teal-300 transition-all duration-300 transform hover:scale-105"><CameraIcon className="h-6 w-6" /><span>{isSubmitting ? 'Processando...' : 'Adicionar Foto'}</span></button>
          </div>
          <input type="file" accept="image/*" capture="environment" ref={fileInputCameraRef} onChange={handleFileChange} className="hidden" aria-hidden="true"/>
          <input type="file" accept="image/*" ref={fileInputGalleryRef} onChange={handleFileChange} className="hidden" aria-hidden="true"/>
          {isSubmitting && <div className="flex flex-col items-center justify-center mt-6 text-slate-600"><Spinner /><p className="mt-2 font-medium">Enviando registro...</p></div>}
          {error && <p className="mt-4 text-center text-red-600 bg-red-100 p-3 rounded-lg">{error}</p>}
          {pendingRecords.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
              <p className="text-yellow-800 text-sm">📶 {pendingRecords.length} registro(s) aguardando sincronização (sem conexão).</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {isLoading && <div className="flex justify-center py-12"><Spinner /></div>}
          {!isLoading && records.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl shadow-md border border-slate-200">
              <CameraIcon className="mx-auto h-16 w-16 text-slate-300" />
              <h3 className="mt-2 text-lg font-medium text-slate-700">Nenhum Registro Ainda</h3>
              <p className="mt-1 text-sm text-slate-500">Clique no botão acima para adicionar seu primeiro registro.</p>
            </div>
          )}
          {records.map(record => {
            const {date, time} = formatDateTime(record.timestamp);
            
            // Função para criar handlers de long press para cada registro
            const createLongPressHandlers = (imageUrl: string) => {
              let longPressTimer: NodeJS.Timeout | undefined;
              let isLongPress = false;
              
              const start = () => {
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                  isLongPress = true;
                  handleLongPress(record);
                }, 500);
              };
              
              const stop = () => {
                if (longPressTimer) {
                  clearTimeout(longPressTimer);
                }
              };
              
              const handleClick = () => {
                if (!isLongPress) {
                  setViewingImage(imageUrl);
                }
              };
              
              return {
                onMouseDown: start,
                onMouseUp: stop,
                onMouseLeave: stop,
                onTouchStart: start,
                onTouchEnd: stop,
                onClick: handleClick,
              };
            };
            
            const longPressHandlers = createLongPressHandlers(record.imageUrl);
            
            return (
              <div 
                key={record.id} 
                {...longPressHandlers}
                className="bg-white rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col sm:flex-row cursor-pointer select-none"
              >
                <img 
                  src={record.imageUrl} 
                  alt="Momento capturado" 
                  className="object-cover rounded-md border border-slate-200 shadow-sm
                    w-full max-w-[120px] max-h-[90px] sm:max-w-[120px] sm:max-h-[90px]
                    h-auto m-2 bg-white"
                  loading="lazy" 
                />
                <div className="p-5 flex flex-col flex-grow">
                  <div className="flex-grow">
                    <div className="flex items-start gap-3 mb-3"><LocationMarkerIcon className="h-6 w-6 text-teal-500 flex-shrink-0 mt-1" /><p className="text-slate-700 font-medium">{record.address}</p></div>
                    <div className="flex items-center gap-3"><CalendarIcon className="h-6 w-6 text-teal-500 flex-shrink-0" /><p className="text-slate-600">{date} às {time}</p></div>
                  </div>
                   <div className="text-right text-xs text-slate-400 pt-4 mt-auto">ID: {record.id.substring(0, 10)}...</div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  );
};

export default App;