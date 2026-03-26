import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { SocioTitular, Ingreso } from '@/lib/types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  UserPlus, 
  Filter, 
  MoreHorizontal, 
  MapPin, 
  CreditCard,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { SocioStatusBadge } from '@/components/custom/SocioStatusBadge';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

const Socios: React.FC = () => {
  const [socios, setSocios] = useState<(SocioTitular & { lastTransaction?: Ingreso })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSocios = async () => {
    setLoading(true);
    try {
      const { data: sociosData, error: sociosError } = await supabase
        .from('socio_titulares')
        .select('*')
        .order('apellidoPaterno', { ascending: true });

      if (sociosError) throw sociosError;

      const sociosWithStatus = await Promise.all((sociosData || []).map(async (socio) => {
        const { data: lastTrans } = await supabase
          .from('ingresos')
          .select('*')
          .eq('dni', socio.dni)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          ...socio,
          lastTransaction: lastTrans || undefined
        };
      }));

      setSocios(sociosWithStatus as any);
    } catch (error) {
      toast.error("Error al cargar socios: " + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSocios();
  }, []);

  const filteredSocios = socios.filter(socio => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${socio.nombres} ${socio.apellidoPaterno} ${socio.apellidoMaterno}`.toLowerCase();
    return fullName.includes(searchLower) || socio.dni.includes(searchTerm);
  });

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#FFFFFF]">
        <Loader2 className="w-12 h-12 animate-spin text-[#4892CC] mb-4" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Sincronizando Padrón de Socios...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-[#FFFFFF] min-h-screen space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Padrón de <span className="text-[#4892CC]">Socios</span></h1>
          <p className="text-slate-500 font-medium">Gestión de estados y expedientes técnicos</p>
        </div>
        <Button className="bg-[#4892CC] hover:bg-[#3C8B93] text-white font-bold rounded-xl px-6 h-12 shadow-lg shadow-[#4892CC]/20">
          <UserPlus className="w-5 h-5 mr-2" /> Nuevo Socio
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input 
            placeholder="Buscar por nombre o DNI..." 
            className="pl-12 h-14 bg-white border-none rounded-2xl shadow-sm text-lg font-medium focus:ring-2 focus:ring-[#4892CC]/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="h-14 rounded-2xl border-none bg-white shadow-sm font-bold text-slate-600">
          <Filter className="w-5 h-5 mr-2" /> Filtros Avanzados
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-b border-slate-100">
              <TableHead className="pl-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Socio / Identidad</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado Actual</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ubicación</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Último Movimiento</TableHead>
              <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSocios.map((socio) => (
              <TableRow key={socio.id} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                <TableCell className="pl-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#E8F1F8] flex items-center justify-center text-[#4892CC] font-black text-lg shadow-sm">
                      {socio.nombres[0]}{socio.apellidoPaterno[0]}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900 uppercase tracking-tight group-hover:text-[#4892CC] transition-colors">
                        {socio.nombres} {socio.apellidoPaterno}
                      </span>
                      <span className="text-xs font-mono text-slate-400 font-bold flex items-center gap-1">
                        <CreditCard className="w-3 h-3" /> {socio.dni}
                      </span>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <SocioStatusBadge 
                    transactionType={socio.lastTransaction?.transaction_type || null} 
                    amount={socio.lastTransaction?.amount || 0} 
                  />
                  {socio.is_payment_observed && (
                    <div className="mt-1 flex items-center gap-1 text-[9px] font-black text-amber-600 uppercase">
                      <AlertTriangle className="w-3 h-3" /> Observado
                    </div>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-300" />
                      Mz. {socio.mz} - Lt. {socio.lote}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase ml-5">{socio.localidad}</span>
                  </div>
                </TableCell>

                <TableCell>
                  {socio.lastTransaction ? (
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-700">
                        {formatCurrency(socio.lastTransaction.amount)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {socio.lastTransaction.transaction_type} — {new Date(socio.lastTransaction.date).toLocaleDateString()}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-300 uppercase italic">Sin movimientos</span>
                  )}
                </TableCell>

                <TableCell className="pr-8 text-right">
                  <Button variant="ghost" size="icon" className="rounded-xl hover:bg-[#E8F1F8] hover:text-[#4892CC]">
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Socios;
