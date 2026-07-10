import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, Timestamp, getCountFromServer, where } from 'firebase/firestore';
import { db } from '../firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState({ hoje: 0, semana: 0, mes: 0, total: 0 });
  const [bairros, setBairros] = useState<{ name: string; count: number }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ name: string; total: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const tsDay = Timestamp.fromDate(startOfDay);
        const tsWeek = Timestamp.fromDate(startOfWeek);
        const tsMonth = Timestamp.fromDate(startOfMonth);

        const [totalSnap, hojeSnap, semanaSnap, mesSnap, docsSnap] = await Promise.all([
          getCountFromServer(collection(db, 'records')),
          getCountFromServer(query(collection(db, 'records'), where('timestamp', '>=', tsDay))),
          getCountFromServer(query(collection(db, 'records'), where('timestamp', '>=', tsWeek))),
          getCountFromServer(query(collection(db, 'records'), where('timestamp', '>=', tsMonth))),
          getDocs(query(collection(db, 'records'), orderBy('timestamp', 'desc'), limit(500))),
        ]);

        const realTotal = totalSnap.data().count;

        const bairroCount: Record<string, number> = {};
        const monthCount: Record<string, number> = {};

        docsSnap.forEach((doc) => {
          const data = doc.data();
          const timestamp = (data.timestamp as Timestamp).toDate();
          const address = data.address || '';

          const parts = address.split(',').map((p: string) => p.trim());
          if (parts.length >= 3) {
            let bairro = parts[2];
            bairro = bairro.split('(')[0].trim();
            if (bairro && bairro.length < 40) {
              bairroCount[bairro] = (bairroCount[bairro] || 0) + 1;
            }
          }

          const year = timestamp.getFullYear();
          const month = String(timestamp.getMonth() + 1).padStart(2, '0');
          const monthKey = `${year}-${month}`;
          monthCount[monthKey] = (monthCount[monthKey] || 0) + 1;
        });

        const bairrosArray = Object.keys(bairroCount)
          .map(name => ({ name, count: bairroCount[name] }))
          .sort((a, b) => b.count - a.count);

        const sortedMonthKeys = Object.keys(monthCount).sort();
        const chartData = sortedMonthKeys.slice(-6).map(key => {
          const [y, m] = key.split('-');
          const date = new Date(parseInt(y), parseInt(m) - 1, 1);
          const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          return { name: monthName.charAt(0).toUpperCase() + monthName.slice(1), total: monthCount[key] };
        });

        setMetrics({
          hoje: hojeSnap.data().count,
          semana: semanaSnap.data().count,
          mes: mesSnap.data().count,
          total: realTotal,
        });
        setBairros(bairrosArray);
        setMonthlyData(chartData);
      } catch (error) {
        console.error("Erro ao carregar dados da dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-teal-600 mb-4"></div>
        <p className="text-slate-600">Carregando painel...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500 font-medium">Coletas Hoje</p>
          <p className="text-3xl font-bold text-teal-600">{metrics.hoje}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500 font-medium">Esta Semana</p>
          <p className="text-3xl font-bold text-teal-600">{metrics.semana}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500 font-medium">Este Mes</p>
          <p className="text-3xl font-bold text-teal-600">{metrics.mes}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500 font-medium">Total Geral</p>
          <p className="text-3xl font-bold text-slate-700">{metrics.total}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-1 flex flex-col h-[500px]">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-700">Coletas por Bairro</h3>
            <p className="text-xs text-slate-500">Estimativa baseada no endereco</p>
          </div>
          <div className="overflow-y-auto p-0 flex-1">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Bairro</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {bairros.length > 0 ? (
                  bairros.map((bairro, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-sm text-slate-700">{bairro.name}</td>
                      <td className="px-4 py-2 text-sm font-semibold text-teal-600 text-right">{bairro.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-center text-sm text-slate-500">
                      Nenhum dado de bairro encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-2 flex flex-col h-[500px]">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-700">Historico de Coletas</h3>
            <p className="text-xs text-slate-500">Comparativo do volume historico por mes</p>
          </div>
          <div className="flex-1 p-4 pb-8">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false} />
                  <YAxis tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    formatter={(value: number) => [`${value} coletas`, 'Volume']}
                  />
                  <Bar dataKey="total" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Sem dados suficientes para o grafico
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
