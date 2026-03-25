import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Package, Plus, ArrowDownToLine, ArrowUpFromLine,
  History, Box, Trash2, UserCheck, ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  fetchInventoryItems, fetchAssignments, fetchActiveAssignments,
  fetchColaboradores, addInventoryItem, checkoutEquipment,
  returnEquipment, returnAllByColaborador, deleteInventoryItem,
  InventoryItem, InventoryAssignment
} from '@/lib/api/inventoryApi';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/lib/supabaseClient';

// ── Tipo local para el formulario de salida multi-ítem ──
interface CheckoutRow {
  item_id: string;
  quantity: number;
}

export default function InventoryPage() {
  // ── State ─────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [allAssignments, setAllAssignments] = useState<InventoryAssignment[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<InventoryAssignment[]>([]);
  const [colaboradores, setColaboradores] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // ── Permisos ──────────────────────────────────────────
  const { user, roles } = useUser();
  const isAdmin = useMemo(() => roles?.some(r => r.toLowerCase() === 'admin') ?? false, [roles]);
  const [canEdit, setCanEdit] = useState(false);

  // Verificar si el usuario actual es admin O es Gustavo Rivero
  useEffect(() => {
    if (isAdmin) { setCanEdit(true); return; }
    if (!user) { setCanEdit(false); return; }
    // Buscar el colaborador vinculado con este auth user
    supabase.from('colaboradores').select('name, apellidos').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          const fullName = `${data.name} ${data.apellidos}`.trim().toLowerCase();
          setCanEdit(fullName === 'gustavo rivero');
        } 
      });
  }, [user, isAdmin]);

  // Add Item Modal
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newQty, setNewQty] = useState('1');

  // Checkout Modal (Salida de Campo)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutColabId, setCheckoutColabId] = useState('');
  const [checkoutRows, setCheckoutRows] = useState<CheckoutRow[]>([{ item_id: '', quantity: 1 }]);
  const [checkoutNotes, setCheckoutNotes] = useState('');

  // Return All Modal
  const [isReturnAllOpen, setIsReturnAllOpen] = useState(false);
  const [returnAllColabId, setReturnAllColabId] = useState('');

  // ── Data Loading ──────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [_items, _all, _active, _colabs] = await Promise.all([
        fetchInventoryItems(),
        fetchAssignments(),
        fetchActiveAssignments(),
        fetchColaboradores()
      ]);
      setItems(_items);
      setAllAssignments(_all);
      setActiveAssignments(_active);
      setColaboradores(_colabs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al cargar inventario');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Agrupar activos por colaborador ───────────────────
  const activeByColab = activeAssignments.reduce<Record<string, { name: string; items: InventoryAssignment[] }>>((acc, a) => {
    const colab = a.colaboradores;
    const colabName = colab ? `${colab.name} ${colab.apellidos || ''}`.trim() : 'Desconocido';
    if (!acc[a.colaborador_id]) {
      acc[a.colaborador_id] = { name: colabName, items: [] };
    }
    acc[a.colaborador_id].items.push(a);
    return acc;
  }, {});

  // ── Handlers ──────────────────────────────────────────
  const handleAddItem = async () => {
    const qty = parseInt(newQty);
    if (!newName.trim() || qty <= 0) return toast.error('Nombre y cantidad válidos son requeridos');
    try {
      setSaving(true);
      await addInventoryItem({ name: newName.trim(), description: newDesc.trim() || undefined, total_quantity: qty });
      toast.success(`"${newName}" añadido al catálogo`);
      setIsAddItemOpen(false);
      setNewName(''); setNewDesc(''); setNewQty('1');
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al crear equipo');
    } finally { setSaving(false); }
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    if (!confirm(`¿Eliminar "${item.name}" del catálogo?`)) return;
    try {
      await deleteInventoryItem(item.id);
      toast.success('Equipo eliminado');
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al eliminar');
    }
  };

  const handleCheckout = async () => {
    if (!checkoutColabId) return toast.error('Selecciona un colaborador');
    const validRows = checkoutRows.filter(r => r.item_id && r.quantity > 0);
    if (validRows.length === 0) return toast.error('Agrega al menos un equipo');
    try {
      setSaving(true);
      await checkoutEquipment(validRows.map(r => ({
        item_id: r.item_id,
        colaborador_id: checkoutColabId,
        quantity: r.quantity,
        notes: checkoutNotes
      })));
      const colabName = colaboradores.find(c => c.id === checkoutColabId)?.name || '';
      toast.success(`Salida registrada para ${colabName}`);
      setIsCheckoutOpen(false);
      setCheckoutColabId(''); setCheckoutRows([{ item_id: '', quantity: 1 }]); setCheckoutNotes('');
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al registrar salida');
    } finally { setSaving(false); }
  };

  const handleReturnSingle = async (a: InventoryAssignment) => {
    try {
      await returnEquipment(a.id, a.item_id, a.quantity);
      toast.success(`${a.inventory_items?.name || 'Equipo'} devuelto`);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al devolver');
    }
  };

  const handleReturnAll = async () => {
    if (!returnAllColabId) return toast.error('Selecciona un colaborador');
    try {
      setSaving(true);
      const count = await returnAllByColaborador(returnAllColabId);
      if (count === 0) {
        toast.info('Este colaborador no tiene equipos pendientes');
      } else {
        toast.success(`${count} equipo(s) devueltos con éxito`);
      }
      setIsReturnAllOpen(false);
      setReturnAllColabId('');
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al devolver');
    } finally { setSaving(false); }
  };

  // ── Checkout form helpers ─────────────────────────────
  const addCheckoutRow = () => setCheckoutRows(prev => [...prev, { item_id: '', quantity: 1 }]);
  const updateCheckoutRow = (index: number, field: keyof CheckoutRow, value: string | number) => {
    setCheckoutRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };
  const removeCheckoutRow = (index: number) => {
    if (checkoutRows.length <= 1) return;
    setCheckoutRows(prev => prev.filter((_, i) => i !== index));
  };

  // ── Render ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#9E7FFF]" />
      </div>
    );
  }

  const totalEnUso = activeAssignments.length;
  const ingenierosEnCampo = Object.keys(activeByColab).length;

  return (
    <div className="p-6 md:p-8 pb-20 max-w-7xl mx-auto">
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <Package className="w-8 h-8 text-[#9E7FFF]" />
            Inventario de Campo
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            Registro de entrada y salida de equipos para ingenieros en salidas a campo.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setIsAddItemOpen(true)} variant="outline" className="rounded-xl border-slate-200 shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Nuevo Equipo
            </Button>
            <Button onClick={() => setIsReturnAllOpen(true)} variant="outline" className="rounded-xl border-slate-200 shadow-sm">
              <ArrowDownToLine className="w-4 h-4 mr-2" /> Recepción Total
            </Button>
            <Button onClick={() => setIsCheckoutOpen(true)} className="bg-[#9E7FFF] hover:bg-[#8b6ae5] text-white rounded-xl shadow-glass">
              <ArrowUpFromLine className="w-4 h-4 mr-2" /> Registrar Salida
            </Button>
          </div>
        )}
      </div>

      {/* ── Stats rápidos ───────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="rounded-2xl border-gray-100 shadow-glass">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-black text-slate-800">{items.length}</p>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Tipos de Equipo</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-gray-100 shadow-glass">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-black text-green-500">{items.reduce((s, i) => s + i.available_quantity, 0)}</p>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Disponibles</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-gray-100 shadow-glass">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-black text-amber-500">{totalEnUso}</p>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1">En Uso</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-gray-100 shadow-glass">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-black text-[#9E7FFF]">{ingenierosEnCampo}</p>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Ingenieros en Campo</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ────────────────────────────────────── */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="bg-white/80 backdrop-blur-md border border-gray-200 p-1.5 rounded-2xl h-14 shadow-sm mb-6 inline-flex">
          <TabsTrigger value="active" className="rounded-xl px-6 data-[state=active]:bg-[#9E7FFF] data-[state=active]:text-white font-bold text-slate-500 transition-all">
            <UserCheck className="w-4 h-4 mr-2" /> Equipos en Campo
          </TabsTrigger>
          <TabsTrigger value="catalog" className="rounded-xl px-6 data-[state=active]:bg-[#9E7FFF] data-[state=active]:text-white font-bold text-slate-500 transition-all">
            <Box className="w-4 h-4 mr-2" /> Catálogo
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl px-6 data-[state=active]:bg-[#9E7FFF] data-[state=active]:text-white font-bold text-slate-500 transition-all">
            <History className="w-4 h-4 mr-2" /> Historial
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: Equipos en Campo (por ingeniero) ── */}
        <TabsContent value="active" className="mt-4">
          {Object.keys(activeByColab).length === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700">Sin equipos en campo</h3>
              <p className="text-slate-500 max-w-sm mx-auto mt-2">
                Todos los equipos están en almacén. Usa "Registrar Salida" cuando un ingeniero vaya a campo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(activeByColab).map(([colabId, { name, items: colabItems }]) => (
                <Card key={colabId} className="rounded-2xl border border-gray-100 shadow-glass overflow-hidden">
                  <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-purple-50/30 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#9E7FFF]/10 flex items-center justify-center">
                          <UserCheck className="w-4 h-4 text-[#9E7FFF]" />
                        </div>
                        {name}
                      </CardTitle>
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold">
                        {colabItems.length} equipo(s)
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-gray-50">
                      {colabItems.map(a => (
                        <div key={a.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
                          <div>
                            <p className="font-bold text-sm text-slate-700">{a.inventory_items?.name || 'Equipo'}</p>
                            <p className="text-xs text-slate-400">
                              Cant: {a.quantity} · Salida: {format(new Date(a.assigned_at), "d MMM", { locale: es })}
                            </p>
                          </div>
                          {canEdit && (
                            <Button
                              size="sm"
                              onClick={() => handleReturnSingle(a)}
                              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm h-8 text-xs"
                            >
                              <ArrowDownToLine className="w-3 h-3 mr-1" /> Devolver
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Catálogo de Equipos ──────────────── */}
        <TabsContent value="catalog" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(item => {
              const inUse = item.total_quantity - item.available_quantity;
              const pct = item.total_quantity > 0 ? (item.available_quantity / item.total_quantity) * 100 : 0;
              return (
                <Card key={item.id} className="rounded-2xl border border-gray-100 shadow-glass overflow-hidden group relative">
                  {canEdit && (
                    <button
                      onClick={() => handleDeleteItem(item)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <CardHeader className="pb-3 border-b border-gray-50 bg-slate-50/50">
                    <CardTitle className="text-base font-bold text-slate-800">{item.name}</CardTitle>
                    {item.description && <CardDescription className="line-clamp-1 text-xs">{item.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between text-center">
                      <div>
                        <p className="text-2xl font-black text-slate-800">{item.total_quantity}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                      </div>
                      <div className="h-10 w-px bg-slate-100" />
                      <div>
                        <p className={`text-2xl font-black ${item.available_quantity > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {item.available_quantity}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Disponible</p>
                      </div>
                      <div className="h-10 w-px bg-slate-100" />
                      <div>
                        <p className="text-2xl font-black text-amber-500">{inUse}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">En Uso</p>
                      </div>
                    </div>
                    {/* Barra de progreso */}
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-gradient-to-r from-[#9E7FFF] to-[#c4b5fd] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {items.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700">Catálogo Vacío</h3>
                <p className="text-slate-500 max-w-sm mx-auto mt-2">
                  Agrega los equipos de campo (cascos, chalecos, GPS, etc.) para empezar a controlar entradas y salidas.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB: Historial ───────────────────────── */}
        <TabsContent value="history" className="mt-4">
          <Card className="rounded-2xl border border-gray-100 shadow-glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-gray-100 font-bold">
                  <tr>
                    <th className="px-5 py-4">Equipo</th>
                    <th className="px-5 py-4">Ingeniero</th>
                    <th className="px-5 py-4">Cant.</th>
                    <th className="px-5 py-4">Salida</th>
                    <th className="px-5 py-4">Retorno</th>
                    <th className="px-5 py-4">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {allAssignments.map(a => {
                    const isReturned = a.status === 'Devuelto';
                    return (
                      <tr key={a.id} className="bg-white border-b border-gray-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-bold text-slate-700">{a.inventory_items?.name || '—'}</td>
                        <td className="px-5 py-3 font-medium text-slate-600">{a.colaboradores ? `${a.colaboradores.name} ${a.colaboradores.apellidos || ''}`.trim() : '—'}</td>
                        <td className="px-5 py-3 font-black">{a.quantity}</td>
                        <td className="px-5 py-3 text-slate-500">{format(new Date(a.assigned_at), "d MMM yy, p", { locale: es })}</td>
                        <td className="px-5 py-3 text-slate-500">
                          {isReturned && a.returned_at ? format(new Date(a.returned_at), "d MMM yy, p", { locale: es }) : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={isReturned ? 'outline' : 'default'}
                            className={isReturned ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-100 text-amber-800 border-amber-200'}>
                            {isReturned ? 'Devuelto' : 'En Uso'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {allAssignments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                        Aún no hay movimientos de inventario registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ════════════════════════════════════════════════ */}
      {/* MODALES                                          */}
      {/* ════════════════════════════════════════════════ */}

      {/* ── Modal: Nuevo Equipo ─────────────────────── */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 border-none shadow-premium">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Nuevo Equipo</DialogTitle>
            <DialogDescription>Añade un recurso al catálogo de equipos de campo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Nombre</label>
              <Input placeholder="Ej. Casco de Seguridad" value={newName} onChange={e => setNewName(e.target.value)}
                className="rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-[#9E7FFF]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Descripción (Opcional)</label>
              <Input placeholder="Color, talla, marca..." value={newDesc} onChange={e => setNewDesc(e.target.value)}
                className="rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-[#9E7FFF]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Stock Inicial</label>
              <Input type="number" min="1" value={newQty} onChange={e => setNewQty(e.target.value)}
                className="rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-[#9E7FFF]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddItemOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleAddItem} disabled={saving} className="bg-[#9E7FFF] hover:bg-[#8b6ae5] text-white rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Registrar Salida a Campo ─────────── */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-3xl p-6 border-none shadow-premium max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Registrar Salida a Campo</DialogTitle>
            <DialogDescription>Selecciona al ingeniero y los equipos que se lleva.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            {/* Selección de Ingeniero */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Ingeniero / Colaborador</label>
              <Select onValueChange={setCheckoutColabId} value={checkoutColabId}>
                <SelectTrigger className="rounded-xl bg-slate-50 border-slate-200 focus:ring-[#9E7FFF]">
                  <SelectValue placeholder="¿Quién sale a campo?" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-60">
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lista de Equipos */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700">Equipos que se lleva</label>
              {checkoutRows.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select onValueChange={v => updateCheckoutRow(index, 'item_id', v)} value={row.item_id}>
                    <SelectTrigger className="rounded-xl bg-slate-50 border-slate-200 focus:ring-[#9E7FFF] flex-1">
                      <SelectValue placeholder="Seleccionar equipo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {items.map(item => (
                        <SelectItem key={item.id} value={item.id} disabled={item.available_quantity <= 0}>
                          {item.name} ({item.available_quantity} disp.)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number" min="1" value={row.quantity}
                    onChange={e => updateCheckoutRow(index, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-20 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-[#9E7FFF] text-center"
                  />
                  {checkoutRows.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => removeCheckoutRow(index)} className="h-9 w-9 text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCheckoutRow} className="rounded-xl border-dashed w-full text-slate-500">
                <Plus className="w-4 h-4 mr-2" /> Agregar otro equipo
              </Button>
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Observaciones (Opcional)</label>
              <Input placeholder="Ej. Salida a Zona Norte, proyecto ABC..." value={checkoutNotes}
                onChange={e => setCheckoutNotes(e.target.value)}
                className="rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-[#9E7FFF]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCheckoutOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleCheckout} disabled={saving} className="bg-[#9E7FFF] hover:bg-[#8b6ae5] text-white rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Salida'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Recepción Total ──────────────────── */}
      <Dialog open={isReturnAllOpen} onOpenChange={setIsReturnAllOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 border-none shadow-premium">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Recepción Total</DialogTitle>
            <DialogDescription>Devuelve todos los equipos que un ingeniero tiene en campo de una sola vez.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Ingeniero que regresa</label>
              <Select onValueChange={setReturnAllColabId} value={returnAllColabId}>
                <SelectTrigger className="rounded-xl bg-slate-50 border-slate-200 focus:ring-[#9E7FFF]">
                  <SelectValue placeholder="Seleccionar colaborador" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-60">
                  {Object.entries(activeByColab).map(([colabId, { name, items: ci }]) => (
                    <SelectItem key={colabId} value={colabId}>
                      {name} ({ci.length} equipo(s))
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {returnAllColabId && activeByColab[returnAllColabId] && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase">Equipos a devolver:</p>
                {activeByColab[returnAllColabId].items.map(a => (
                  <div key={a.id} className="flex justify-between text-sm">
                    <span className="text-slate-700 font-medium">{a.inventory_items?.name}</span>
                    <span className="text-slate-500">×{a.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsReturnAllOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleReturnAll} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Devolución'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
