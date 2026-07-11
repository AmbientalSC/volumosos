import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { signInAnonymouslyAsync, checkAuthState, auth } from './firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { listRecords, getUploadUrl, createRecord, deleteRecord, exportCsvRows } from './apiClient';
import type { PaginatedResponse } from './apiClient';
import { PhotoRecord, PendingRecord } from './types';
import { loadPendingRecords, savePendingRecord, removePendingRecord, savePendingRecords } from './storage';
import { CameraIcon, ImageIcon, CloudUploadIcon, XIcon } from './components/Icons';
import Spinner from './components/Spinner';
import Modal from './components/Modal';
import RecordCard from './components/RecordCard';
import ToastContainer, { Toast, ToastType } from './components/Toast';

const Dashboard = lazy(() => import('./components/Dashboard'));

const App: React.FC = () => {
  const [records, setRecords] = useState<PhotoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastErrorDetails, setLastErrorDetails] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManualAddressModalOpen, setIsManualAddressModalOpen] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<PhotoRecord | null>(null);

  type ViewState = 'main' | 'login' | 'dashboard';
  const [currentView, setCurrentView] = useState<ViewState>('main');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [pendingRecord, setPendingRecord] = useState<{ id: string; base64: string; timestamp: Date } | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showReportFilters, setShowReportFilters] = useState(false);
  const [isGeneratingCSV, setIsGeneratingCSV] = useState(false);

  const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [compressionStats, setCompressionStats] = useState<{ original: number; compressed: number } | null>(null);

  const fileInputCameraRef = useRef<HTMLInputElement>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const scrollYRef = useRef(0);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [onlineStatus, setOnlineStatus] = useState(navigator.onLine);
  const [searchQuery, setSearchQuery] = useState('');
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartY = useRef(0);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

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

  // Em ambiente nativo (Android/iOS), solicitar permissão de localização no início
  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          await Geolocation.requestPermissions();
          console.log('Permissão de localização solicitada (nativo)');
        }
      } catch (e) {
        console.warn('Falha ao solicitar permissão de localização:', e);
      }
    };
    requestLocationPermission();
  }, []);

  const REALTIME_POLL_INTERVAL_MS = 20000;

  const fetchRecords = useCallback(async (page = 1, reset = true) => {
    try {
      const result = await listRecords({
        page,
        limit: 20,
        search: searchQuery || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (reset) {
        setRecords(result.data);
      } else {
        setRecords(prev => [...prev, ...result.data]);
      }
      setCurrentPage(page);
      setHasMore(page < result.pagination.totalPages);
      setTotalRecords(result.pagination.total);
    } catch (error) {
      console.error("Error fetching records:", error);
      if (reset) setError("Não foi possível carregar os registros. Verifique sua conexão.");
    }
  }, [searchQuery, startDate, endDate]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    await fetchRecords(currentPage + 1, false);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, currentPage, fetchRecords]);

  useEffect(() => {
    if (!isAuthenticated) {
      console.log("Usuário não autenticado ainda, aguardando...");
      return;
    }

    console.log("Usuário autenticado, carregando registros...");
    setIsLoading(true);
    fetchRecords(1, true).finally(() => setIsLoading(false));

    const interval = setInterval(() => { fetchRecords(1, true); }, REALTIME_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchRecords]);

  // Scroll infinito
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  // Carregar registros pendentes do IndexedDB
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await loadPendingRecords();
        if (stored.length > 0) {
          setPendingRecords(stored);
          console.log(`${stored.length} registros pendentes carregados do armazenamento offline`);
        }
      } catch (e) {
        console.error('Erro ao carregar registros pendentes do IndexedDB:', e);
      }
    };
    load();
  }, []);

  // Sync automático: quando autenticado + pendentes + online, dispara sincronização
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

  // Verificação periódica de sincronização (a cada 30s)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isSyncingRef.current && isAuthenticated && navigator.onLine) {
        try {
          const stored = await loadPendingRecords();
          if (stored.length > 0) {
            console.log(`Verificação periódica: ${stored.length} pendentes, tentando sincronizar...`);
            isSyncingRef.current = true;
            if (stored.length !== pendingRecords.length) {
              setPendingRecords(stored);
            }
            syncPendingRecords().finally(() => {
              isSyncingRef.current = false;
            });
          }
        } catch (e) {
          console.error('Erro na verificação periódica:', e);
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Migrar registros do localStorage antigo para IndexedDB (executado uma vez na vida)
  useEffect(() => {
    const migrateFromLocalStorage = async () => {
      try {
        const stored = localStorage.getItem('pendingRecords');
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed) || parsed.length === 0) return;
        
        const existing = await loadPendingRecords();
        if (existing.length > 0) return;
        
        const migrated = parsed.map((p: any) => ({
          id: crypto.randomUUID(),
          base64: p.base64,
          address: p.address,
          timestamp: new Date(p.timestamp),
          latitude: p.latitude,
          longitude: p.longitude,
        }));
        
        await savePendingRecords(migrated);
        localStorage.removeItem('pendingRecords');
        setPendingRecords(migrated);
        console.log(`${migrated.length} registros migrados do localStorage para IndexedDB`);
      } catch (e) {
        console.error('Erro ao migrar registros do localStorage:', e);
      }
    };
    migrateFromLocalStorage();
  }, []);

  // Monitorar status online/offline com indicador visual
  useEffect(() => {
    const handleOnline = () => { setOnlineStatus(true); addToast('Conexão restaurada', 'success'); };
    const handleOffline = () => { setOnlineStatus(false); addToast('Sem conexão com a internet', 'warning'); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast]);

  // Header colapsável ao scroll
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentY = window.scrollY;
          if (currentY > 80 && currentY > scrollYRef.current) {
            setIsHeaderCollapsed(true);
          } else if (currentY < 40) {
            setIsHeaderCollapsed(false);
          }
          scrollYRef.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Pull-to-refresh
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        pullStartY.current = e.touches[0].clientY;
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY === 0 && pullStartY.current > 0) {
        const dy = e.touches[0].clientY - pullStartY.current;
        if (dy > 60) {
          setIsPulling(true);
        }
      }
    };
    const handleTouchEnd = () => {
      if (isPulling) {
        setIsPulling(false);
      }
      pullStartY.current = 0;
    };
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling]);

  const filteredRecords = records;

  // Promise com timeout para evitar travas indefinidas (rede lenta/offline)
  const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const id = setTimeout(() => reject(new Error('Tempo esgotado ao enviar. Verifique a conexão.')), ms);
      promise.then((value) => { clearTimeout(id); resolve(value); })
             .catch((err) => { clearTimeout(id); reject(err); });
    });
  };

  // Função otimizada de compressão de imagem com Canvas
  const compressImage = async (file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.85): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calcular dimensões mantendo aspect ratio
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }
          
          // Criar canvas e comprimir
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Falha ao criar contexto do canvas'));
            return;
          }
          
          // Renderizar com qualidade alta
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          // Converter para blob com compressão
          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log(`Imagem comprimida: ${(file.size / 1024).toFixed(1)}KB → ${(blob.size / 1024).toFixed(1)}KB (${Math.round((1 - blob.size / file.size) * 100)}% menor)`);
                resolve(blob);
              } else {
                reject(new Error('Falha ao gerar blob comprimido'));
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('Falha ao carregar imagem'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  };

  const saveRecord = async (base64: string, address: string, timestamp: Date, latitude?: number, longitude?: number) => {
    setIsSubmitting(true);
    setError(null);
    setUploadProgress(0);
    try {
      console.log("Iniciando upload da imagem...");
      setUploadProgress(10);
      
      const blob = fromBase64(base64);
      const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
      const originalSize = file.size;
      
      // Comprimir imagem
      setUploadProgress(20);
      console.log("Comprimindo imagem...");
      const compressedBlob = await compressImage(file);
      setCompressionStats({ original: originalSize, compressed: compressedBlob.size });
      
      setUploadProgress(40);
      await withTimeout((async () => {
        setUploadProgress(50);
        const { uploadUrl, imageKey } = await getUploadUrl();
        const putResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: compressedBlob,
        });
        if (!putResponse.ok) throw new Error('Falha ao enviar imagem para o armazenamento.');
        setUploadProgress(70);
        console.log("Imagem enviada com sucesso");

        console.log("Salvando registro...");
        await createRecord({
          imageKey,
          address,
          capturedAt: timestamp.toISOString(),
          ...(latitude !== undefined && { latitude }),
          ...(longitude !== undefined && { longitude }),
        });
        setUploadProgress(85);
        await fetchRecords();
        setUploadProgress(100);
        console.log("Registro salvo com sucesso");
        addToast('Foto enviada com sucesso!', 'success');

        // Limpar stats após 3s
        setTimeout(() => setCompressionStats(null), 3000);
      })(), 30000); // 30s de timeout para upload comprimido
    } catch (err) {
      console.error("Error saving record:", err);
      console.error("Código do erro:", (err as any).code);
      console.error("Mensagem do erro:", (err as any).message);
      setError("Falha ao salvar o registro. Armazenado localmente para sincronização posterior.");
      try {
        const code = (err as any)?.code || 'unknown';
        const message = (err as any)?.message || String(err);
        setLastErrorDetails(`saveRecord failed\ncode: ${code}\nmessage: ${message}`);
      } catch {}
      throw err; // Re-throw para capturar no caller
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
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

  // Helper para obter latitude/longitude em web ou nativo
  const getLatLon = async (): Promise<{ latitude: number; longitude: number }> => {
    if (Capacitor.isNativePlatform()) {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    }
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 8000, maximumAge: 0,
      });
    });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
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
      
      // Tentar obter coordenadas GPS (funciona offline)
      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const coords = await getLatLon();
        latitude = coords.latitude;
        longitude = coords.longitude;
      } catch (gpsErr) {
        console.warn('GPS não disponível no momento:', gpsErr);
      }

      const isOnline = navigator.onLine;

      // Se temos coordenadas, tentar geocoding (requer rede)
      if (latitude !== undefined && longitude !== undefined) {
        try {
          const address = await fetchAddress(latitude, longitude);
          if (isOnline) {
            try {
              await saveRecord(base64, address, timestamp, latitude, longitude);
            } catch (uploadErr) {
              console.error('Upload falhou, armazenando offline:', uploadErr);
              const id = crypto.randomUUID();
              const record: PendingRecord = { id, base64, address, timestamp, latitude, longitude };
              await savePendingRecord(record);
              setPendingRecords(prev => [...prev, record]);
              setError("Registro armazenado localmente devido a falha de conexão. Será sincronizado quando houver rede.");
              try {
                const code = (uploadErr as any)?.code || 'unknown';
                const message = (uploadErr as any)?.message || String(uploadErr);
                setLastErrorDetails(`handleFileChange/saveRecord catch\ncode: ${code}\nmessage: ${message}`);
              } catch {}
            }
          } else {
            const id = crypto.randomUUID();
            const record: PendingRecord = { id, base64, address, timestamp, latitude, longitude };
            await savePendingRecord(record);
            setPendingRecords(prev => [...prev, record]);
            addToast('Registro salvo offline. Sera sincronizado automaticamente.', 'warning');
            setError("Sem conexao. Registro armazenado localmente e sera sincronizado automaticamente quando houver rede.");
          }
        } catch (geocodingErr) {
          console.warn('Geocoding falhou (offline), salvando com coordenadas para posterior:', geocodingErr);
          const id = crypto.randomUUID();
          const record: PendingRecord = { 
            id,
            base64, 
            address: `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (aguardando geocoding)`, 
            timestamp, 
            latitude, 
            longitude 
          };
          await savePendingRecord(record);
          setPendingRecords(prev => [...prev, record]);
          addToast('Coordenadas GPS salvas. Endereco sera obtido quando houver rede.', 'info');
          setError("Sem conexao para obter endereco. Coordenadas GPS salvas; endereco sera obtido automaticamente quando houver rede.");
        }
      } else {
        let message = 'GPS não disponível. Por favor, digite o endereço manualmente.';
        setGeoError(message);
        setPendingRecord({ id: crypto.randomUUID(), base64, timestamp });
        setIsManualAddressModalOpen(true);
      }
    } catch (err) {
      console.error("Erro ao processar arquivo:", err);
      setError("Erro ao processar a imagem.");
    } finally {
        setIsSubmitting(false);
        resetInputs();
    }
  };

  const handleTakePhoto = () => { setIsModalOpen(false); fileInputCameraRef.current?.click(); };
  const handleChooseFromGallery = () => { setIsModalOpen(false); fileInputGalleryRef.current?.click(); };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setCurrentView('dashboard');
      setLoginEmail('');
      setLoginPassword('');
    } catch (err: any) {
      console.error(err);
      setLoginError('Falha no login. Verifique e-mail e senha.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentView('main');
    signInAnonymouslyAsync();
  };

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
      const id = pendingRecord.id;
      const record: PendingRecord = { id, base64: pendingRecord.base64, address: manualAddress, timestamp: pendingRecord.timestamp };
      await savePendingRecord(record);
      setPendingRecords(prev => [...prev, record]);
      setError("Registro armazenado localmente devido a falha de conexão. Será sincronizado quando houver rede.");
    }
    setPendingRecord(null); setManualAddress(''); setAddressSuggestions([]); setGeoError(null);
  };

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;
    
    setIsSubmitting(true);
    try {
      await deleteRecord(recordToDelete.id);
      console.log("Registro deletado");

      setIsDeleteModalOpen(false);
      setRecordToDelete(null);
      addToast('Registro excluido com sucesso', 'success');
      await fetchRecords();
    } catch (error) {
      console.error("Erro ao deletar registro:", error);
      setError("Falha ao deletar o registro. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateCSV = async () => {
    setIsGeneratingCSV(true);
    try {
      const exportRows = await exportCsvRows(startDate, endDate);

      if (exportRows.length === 0) {
        alert("Nenhum registro encontrado para o período selecionado.");
        return;
      }

      // Cabeçalho: Data;Local;LINK PARA A IMAGEM
      const headers = ['Data', 'Local', 'LINK PARA A IMAGEM'];
      const rows = exportRows.map(row => {
          const timestamp = new Date(row.capturedAt);
          const address = row.address || '';

          // Formatar data e hora: dd/mm/aaaa hh:mm
          const day = timestamp.getDate().toString().padStart(2, '0');
          const month = (timestamp.getMonth() + 1).toString().padStart(2, '0');
          const year = timestamp.getFullYear();
          const hours = timestamp.getHours().toString().padStart(2, '0');
          const minutes = timestamp.getMinutes().toString().padStart(2, '0');
          const dateTime = `${day}/${month}/${year} ${hours}:${minutes}`;

          const local = address.replace(/;/g, ','); // Evita quebrar coluna
          // Hiperlink Excel: =HYPERLINK("url";"Clique aqui")
          const link = `${row.imageUrl}`;
          return [dateTime, local, link].join(';');
      });
      const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
      link.download = 'relatorio_fotos.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Erro ao gerar relatório:", err);
      alert("Erro ao buscar dados para o relatório.");
    } finally {
      setIsGeneratingCSV(false);
    }
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
    const records = await loadPendingRecords();
    if (records.length === 0 || !isAuthenticated) return;
    setIsSyncing(true);
    try {
      console.log(`Tentando sincronizar ${records.length} registros pendentes...`);
      
      const PARALLEL_UPLOADS = 2;
      for (let i = 0; i < records.length; i += PARALLEL_UPLOADS) {
        const batch = records.slice(i, i + PARALLEL_UPLOADS);
        const results = await Promise.allSettled(
          batch.map(async (record) => {
            let finalAddress = record.address;
            
            if (record.latitude !== undefined && record.longitude !== undefined && record.address.startsWith('GPS:')) {
              try {
                console.log(`Fazendo geocoding reverso de coordenadas salvas: ${record.latitude}, ${record.longitude}`);
                finalAddress = await fetchAddress(record.latitude, record.longitude);
                console.log(`Endereço obtido via geocoding: ${finalAddress}`);
              } catch (geocodingErr) {
                console.warn('Geocoding ainda falhou, mantendo coordenadas:', geocodingErr);
                throw geocodingErr;
              }
            }
            
            await saveRecord(record.base64, finalAddress, record.timestamp, record.latitude, record.longitude);
            await removePendingRecord(record.id);
            console.log('Registro pendente sincronizado e removido do armazenamento offline');
          })
        );
        
        results.forEach((result) => {
          if (result.status === 'rejected') {
            console.error('Falha ao sincronizar registro pendente:', result.reason);
            try {
              const code = (result.reason as any)?.code || 'unknown';
              const message = (result.reason as any)?.message || String(result.reason);
              setLastErrorDetails(`syncPendingRecords item failed\ncode: ${code}\nmessage: ${message}`);
            } catch {}
          }
        });
      }
      
      const remaining = await loadPendingRecords();
      setPendingRecords(remaining);
      if (remaining.length === 0) {
        console.log('Todos os registros pendentes foram sincronizados');
        addToast('Todos os registros foram sincronizados', 'success');
      } else {
        console.log(`${remaining.length} registros ainda pendentes apos sincronizacao`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Indicador online/offline */}
      <div className={`fixed top-0 left-0 right-0 z-50 h-1.5 transition-colors duration-300 ${onlineStatus ? 'bg-emerald-500' : 'bg-red-500'}`} />

      <header className={`bg-white shadow-md sticky top-0 z-20 transition-all duration-300 ${isHeaderCollapsed ? 'py-2' : ''}`}>
        <div className={`w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-300 ${isHeaderCollapsed ? 'py-1' : 'py-4 md:py-6'}`}>
          <div className={`flex items-center gap-2 ${isHeaderCollapsed ? 'justify-start' : 'flex-col sm:flex-row justify-between mb-2 md:mb-4'}`}>
            <div className="w-full sm:w-32 hidden sm:block"></div>
            <h1 className={`font-bold text-teal-600 tracking-tight text-center flex-1 transition-all duration-300 ${isHeaderCollapsed ? 'text-base text-left' : 'text-xl sm:text-2xl md:text-3xl'}`}>Controle de Volumosos - BC</h1>
            <div className={`w-full sm:w-32 flex justify-center sm:justify-end ${isHeaderCollapsed ? 'hidden sm:flex' : ''}`}>
              {!Capacitor.isNativePlatform() && (
                currentView === 'main' ? (
                  <button
                    onClick={() => setCurrentView('login')}
                    className="hidden sm:block px-3 py-1.5 text-sm font-medium bg-slate-200 text-slate-700 hover:bg-slate-300 rounded transition-colors"
                  >
                    Acesso Restrito
                  </button>
                ) : (
                  <button
                    onClick={() => currentView === 'login' ? setCurrentView('main') : handleLogout()}
                    className="hidden sm:block px-3 py-1.5 text-sm font-medium bg-slate-200 text-slate-700 hover:bg-slate-300 rounded transition-colors"
                  >
                    {currentView === 'login' ? 'Voltar ao App' : 'Sair (Logout)'}
                  </button>
                )
              )}
            </div>
          </div>

          {!isHeaderCollapsed && (
          <div className="flex justify-center mb-2 md:mb-3">
            <button
              onClick={() => setShowReportFilters(!showReportFilters)}
              className="px-3 py-1.5 md:px-4 md:py-2 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-colors flex items-center gap-2 text-sm md:text-base"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{showReportFilters ? 'Ocultar Relatório' : 'Gerar Relatório'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 md:h-4 md:w-4 transition-transform ${showReportFilters ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          )}

          {showReportFilters && !isHeaderCollapsed && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 md:p-4 max-w-xl mx-auto">
              <div className="grid grid-cols-2 gap-2 md:gap-3 mb-2 md:mb-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="startDate" className="text-xs md:text-sm font-medium text-slate-600">De:</label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-2 py-1.5 md:px-3 md:py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm w-full"
                    aria-label="Data inicial do filtro"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="endDate" className="text-xs md:text-sm font-medium text-slate-600">Até:</label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-2 py-1.5 md:px-3 md:py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm w-full"
                    aria-label="Data final do filtro"
                  />
                </div>
              </div>
              <button
                onClick={generateCSV}
                disabled={isGeneratingCSV}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 md:py-2.5 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm md:text-base"
              >
                {isGeneratingCSV ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Gerando...</span>
                  </>
                ) : (
                  <span>Gerar Relatório</span>
                )}
              </button>
            </div>
          )}
        </div>
      </header>
      
      {currentView === 'login' && (
        <main className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-md">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
            <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">Acesso Administrativo</h2>
            {loginError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{loginError}</div>}
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" />
              </div>
              <button type="submit" disabled={isLoggingIn} className="w-full py-3 bg-teal-600 text-white font-bold rounded-lg shadow-md hover:bg-teal-700 disabled:bg-teal-400 transition-colors">
                {isLoggingIn ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </div>
        </main>
      )}

      {currentView === 'dashboard' && (
        <main className="w-full max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-teal-600 mb-4"></div>
              <p className="text-slate-600">Carregando painel...</p>
            </div>
          }>
            <Dashboard />
          </Suspense>
        </main>
      )}

      {currentView === 'main' && (
        <>
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

          <main className="w-full max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8 pb-24">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg mb-6 md:mb-8 border border-slate-200">
          <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-center">Adicionar um Novo Registro</h2>
          <div className="flex justify-center">
              <button onClick={() => setIsModalOpen(true)} disabled={isSubmitting} className="w-full sm:w-auto flex items-center justify-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 bg-teal-500 text-white font-bold rounded-lg shadow-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75 disabled:bg-teal-300 transition-all duration-300 transform hover:scale-105 text-sm md:text-base"><CameraIcon className="h-5 w-5 md:h-6 md:w-6" /><span>{isSubmitting ? 'Processando...' : 'Adicionar Foto'}</span></button>
          </div>
          <input type="file" accept="image/*" capture="environment" ref={fileInputCameraRef} onChange={handleFileChange} className="hidden" aria-hidden="true"/>
          <input type="file" accept="image/*" ref={fileInputGalleryRef} onChange={handleFileChange} className="hidden" aria-hidden="true"/>
          
          {isSubmitting && (
            <div className="flex flex-col items-center justify-center mt-4 md:mt-6 text-slate-600">
              <Spinner />
              <p className="mt-2 font-medium text-sm md:text-base">
                {uploadProgress < 20 ? 'Processando imagem...' :
                 uploadProgress < 40 ? 'Comprimindo...' :
                 uploadProgress < 70 ? 'Enviando...' :
                 uploadProgress < 100 ? 'Finalizando...' : 'Concluido!'}
              </p>
              <div className="w-full max-w-xs mt-3 bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-teal-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              {uploadProgress > 0 && (
                <p className="mt-1 text-sm text-slate-500">{uploadProgress}%</p>
              )}
            </div>
          )}
          
          {compressionStats && (
            <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg text-center">
              <p className="text-green-800 text-xs md:text-sm">
                Imagem otimizada: {(compressionStats.original / 1024).toFixed(1)}KB &rarr; {(compressionStats.compressed / 1024).toFixed(1)}KB
                <span className="font-semibold ml-1">
                  ({Math.round((1 - compressionStats.compressed / compressionStats.original) * 100)}% menor)
                </span>
              </p>
            </div>
          )}
          
          {error && (
            <div className="mt-4 text-center text-red-600 bg-red-100 p-3 rounded-lg">
              <p className="text-sm">{error}</p>
              {lastErrorDetails && (
                <div className="mt-2 text-left">
                  <button
                    type="button"
                    onClick={() => setShowErrorDetails(s => !s)}
                    className="text-sm text-red-700 underline"
                  >
                    {showErrorDetails ? 'Ocultar detalhes' : 'Mostrar detalhes do erro'}
                  </button>
                  {showErrorDetails && (
                    <div className="mt-2 bg-white text-slate-700 border border-red-200 rounded p-2 overflow-auto max-h-40">
                      <pre className="text-xs whitespace-pre-wrap break-words">{lastErrorDetails}</pre>
                      <div className="mt-2 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            try { await navigator.clipboard.writeText(lastErrorDetails); } catch {}
                          }}
                          className="text-xs px-2 py-1 bg-slate-200 rounded hover:bg-slate-300"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {pendingRecords.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
              <p className="text-yellow-800 text-sm">
                {isSyncing
                  ? `Sincronizando ${pendingRecords.length} registro(s) pendente(s)...`
                  : `${pendingRecords.length} registro(s) aguardando sincronizacao (sem conexao).`
                }
              </p>
            </div>
          )}
        </div>

        {/* Barra de busca */}
        {records.length > 0 && !isLoading && (
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por endereco..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
                  debounceTimeoutRef.current = window.setTimeout(() => {
                    setCurrentPage(1);
                    setHasMore(true);
                    fetchRecords(1, true);
                  }, 400);
                }}
                className="w-full px-4 py-2.5 pl-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-white shadow-sm"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Pull-to-refresh indicator */}
        {isPulling && (
          <div className="flex justify-center py-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-t-2 border-teal-500"></div>
          </div>
        )}

        <div className="space-y-6">
          {isLoading && <div className="flex justify-center py-12"><Spinner /></div>}
          {!isLoading && records.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl shadow-md border border-slate-200">
              <CameraIcon className="mx-auto h-16 w-16 text-slate-300" />
              <h3 className="mt-2 text-lg font-medium text-slate-700">Nenhum Registro Ainda</h3>
              <p className="mt-1 text-sm text-slate-500">Clique no botao acima para adicionar seu primeiro registro.</p>
            </div>
          )}
          {!isLoading && records.length > 0 && searchQuery && filteredRecords.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p>Nenhum registro encontrado para "{searchQuery}"</p>
            </div>
          )}
          {!isLoading && records.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {filteredRecords.map(record => (
                <RecordCard
                  key={record.id}
                  record={record}
                  isSelected={false}
                  onTap={(rec) => setViewingImage(rec.imageUrl)}
                  onDelete={(rec) => {
                    setRecordToDelete(rec);
                    setIsDeleteModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* FAB - Floating Action Button */}
      {currentView === 'main' && (
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isSubmitting}
          className="fixed bottom-6 right-6 z-30 w-14 h-14 bg-teal-500 text-white rounded-full shadow-xl hover:bg-teal-600 active:scale-95 disabled:bg-teal-300 transition-all duration-300 flex items-center justify-center"
          aria-label="Adicionar foto"
        >
          <CameraIcon className="h-7 w-7" />
        </button>
      )}

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
      )}
    </div>
  );
};

export default App;