import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Save, X, AlertCircle, Search, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Ingreso } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useDebounce } from 'use-debounce';

const transactionSchema = z.object({
  date: z.string().min(1, 'La fecha es requerida'),
  receipt_number: z.string().min(1, 'El número de recibo es requerido'),
  dni: z.string().min(8, 'DNI inválido').max(8, 'DNI inválido'),
  full_name: z.string().min(1, 'El nombre es requerido'),
  amount: z.number(),
  account: z.string().min(1, 'La cuenta es requerida'),
  transaction_type: z.string().min(1, 'El tipo es requerido'),
  numeroOperacion: z.number().optional().nullable(),
  is_payment_observed: z.boolean().default(false),
  payment_observation_detail: z.string().optional().nullable(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  initialData?: Ingreso;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TransactionForm({ initialData, onClose, onSuccess }: TransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingDni, setIsSearchingDni] = useState(false);
  const [dniNotFound, setDniNotFound] = useState(false);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: initialData?.date || new Date().toISOString().split('T')[0],
      receipt_number: initialData?.receipt_number || '',
      dni: initialData?.dni || '',
      full_name: initialData?.full_name || '',
      amount: initialData?.amount || 0,
      account: initialData?.account || 'Efectivo',
      transaction_type: initialData?.transaction_type || 'Ingreso',
      numeroOperacion: initialData?.numeroOperacion || null,
      is_payment_observed: initialData?.socio_titulares?.is_payment_observed || false,
      payment_observation_detail: initialData?.socio_titulares?.payment_observation_detail || '',
    },
  });

  const transactionType = form.watch('transaction_type');
  const isObserved = form.watch('is_payment_observed');
  const dniValue = form.watch('dni');
  const [debouncedDni] = useDebounce(dniValue, 500);

  // Lógica automática para Anulación y Devolución
  useEffect(() => {
    if (transactionType === 'Anulación') {
      form.setValue('amount', 0);
    } else if ((transactionType === 'Devolución' || transactionType === 'Gasto') && form.getValues('amount') > 0) {
      // Si es devolución o gasto, forzamos que el valor visual sea negativo si el usuario pone algo positivo
      const currentAmount = form.getValues('amount');
      form.setValue('amount', -Math.abs(currentAmount));
    }
  }, [transactionType, form]);

  useEffect(() => {
    const fetchSocioData = async () => {
      if (debouncedDni && debouncedDni.length === 8) {
        setIsSearchingDni(true);
        setDniNotFound(false);
        try {
          const { data, error } = await supabase
            .from('socio_titulares')
            .select('nombres, apellidoPaterno, apellidoMaterno, is_payment_observed, payment_observation_detail')
            .eq('dni', debouncedDni)
            .single();

          if (error && error.code !== 'PGRST116') throw error;

          if (data) {
            const fullName = `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`.trim();
            form.setValue('full_name', fullName, { shouldValidate: true });
            form.setValue('is_payment_observed', data.is_payment_observed || false);
            form.setValue('payment_observation_detail', data.payment_observation_detail || '');
            setDniNotFound(false);
          } else {
            form.setValue('full_name', '', { shouldValidate: true });
            setDniNotFound(true);
          }
        } catch (error) {
          console.error('Error fetching socio:', error instanceof Error ? error.message : error);
          setDniNotFound(true);
        } finally {
          setIsSearchingDni(false);
        }
      }
    };

    if (debouncedDni !== initialData?.dni) {
      fetchSocioData();
    }
  }, [debouncedDni, form, initialData?.dni]);

  const onSubmit = async (values: TransactionFormValues) => {
    setIsSubmitting(true);
    try {
      // REGLAS DE NEGOCIO FINALES ANTES DE GUARDAR
      let finalAmount = values.amount;
      
      if (values.transaction_type === 'Anulación') {
        finalAmount = 0;
      } else if (values.transaction_type === 'Devolución' || values.transaction_type === 'Gasto') {
        finalAmount = -Math.abs(values.amount); // Siempre negativo
      } else {
        finalAmount = Math.abs(values.amount); // Ingresos siempre positivos
      }

      const { is_payment_observed, payment_observation_detail, ...incomeData } = values;
      const dataToSave = { ...incomeData, amount: finalAmount };

      let incomeError;
      if (initialData) {
        const { error } = await supabase
          .from('ingresos')
          .update(dataToSave)
          .eq('id', initialData.id);
        incomeError = error;
      } else {
        const { error } = await supabase
          .from('ingresos')
          .insert([dataToSave]);
        incomeError = error;
      }

      if (incomeError) throw incomeError;

      // Actualizar socio
      await supabase
        .from('socio_titulares')
        .update({
          is_payment_observed,
          payment_observation_detail: is_payment_observed ? payment_observation_detail : null
        })
        .eq('dni', values.dni);

      toast.success('Registro procesado correctamente');
      onSuccess();
    } catch (error) {
      toast.error('Error al guardar: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="transaction_type"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tipo de Transacción</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className={cn(
                      "h-14 border-none rounded-xl font-bold text-lg transition-all",
                      field.value === 'Anulación' && "bg-red-50 text-red-600 ring-2 ring-red-100",
                      field.value === 'Devolución' && "bg-amber-50 text-amber-600 ring-2 ring-amber-100",
                      field.value === 'Ingreso' && "bg-emerald-50 text-emerald-600 ring-2 ring-emerald-100"
                    )}>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Ingreso" className="font-bold text-emerald-600">Ingreso</SelectItem>
                    <SelectItem value="Recibo de Pago" className="font-bold text-corp-blue">Recibo de Pago</SelectItem>
                    <SelectItem value="Gasto" className="font-bold text-orange-600">Gasto (Salida)</SelectItem>
                    <SelectItem value="Devolución" className="font-bold text-amber-600">Devolución (Salida)</SelectItem>
                    <SelectItem value="Anulación" className="font-bold text-red-600">Anulación (Monto 0)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Fecha</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="h-12 bg-slate-50 border-none rounded-xl font-medium" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="receipt_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nº Recibo / Documento</FormLabel>
                <FormControl>
                  <Input placeholder="R-00001" {...field} className="h-12 bg-slate-50 border-none rounded-xl font-mono font-bold" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dni"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">DNI del Socio</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      placeholder="8 dígitos" 
                      {...field} 
                      maxLength={8} 
                      className="pl-10 h-12 bg-slate-50 border-none rounded-xl font-mono" 
                    />
                    {isSearchingDni ? (
                      <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-corp-blue animate-spin" />
                    ) : (
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nombre Completo</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Nombre del socio" 
                    {...field} 
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase" 
                    readOnly={isSearchingDni || (dniValue.length === 8 && !dniNotFound)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Monto (S/.)
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00" 
                      {...field} 
                      disabled={transactionType === 'Anulación'}
                      onChange={e => field.onChange(parseFloat(e.target.value))}
                      className={cn(
                        "h-16 pl-12 bg-slate-50 border-none rounded-2xl font-black text-2xl transition-all",
                        transactionType === 'Anulación' && "bg-slate-100 text-slate-400",
                        (transactionType === 'Devolución' || transactionType === 'Gasto') && "text-red-600",
                        (transactionType === 'Ingreso' || transactionType === 'Recibo de Pago') && "text-emerald-600"
                      )} 
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">S/</span>
                  </div>
                </FormControl>
                <FormDescription className="flex items-center gap-1.5 mt-2">
                  {transactionType === 'Anulación' && (
                    <span className="text-red-500 font-bold flex items-center gap-1">
                      <Info className="h-3 w-3" /> El monto se fuerza a 0 por anulación.
                    </span>
                  )}
                  {transactionType === 'Devolución' && (
                    <span className="text-amber-600 font-bold flex items-center gap-1">
                      <Info className="h-3 w-3" /> El monto se registrará como negativo (salida).
                    </span>
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="account"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cuenta / Método</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-medium">
                      <SelectValue placeholder="Seleccionar cuenta" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="BBVA Empresa">BBVA Empresa</SelectItem>
                    <SelectItem value="Cuenta Fidel">Cuenta Fidel</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="numeroOperacion"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nº Operación (Opcional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Ej: 123456" 
                    value={field.value || ''} 
                    onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    className="h-12 bg-slate-50 border-none rounded-xl font-mono" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className={cn(
          "p-6 rounded-2xl transition-all duration-300 border-2",
          isObserved ? "bg-amber-50 border-amber-200" : "bg-slate-50/50 border-transparent"
        )}>
          <FormField
            control={form.control}
            name="is_payment_observed"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="h-6 w-6 rounded-lg border-slate-300 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-black text-slate-700 uppercase tracking-tight flex items-center gap-2">
                    <AlertCircle className={cn("h-4 w-4", isObserved ? "text-amber-600" : "text-slate-400")} />
                    Observar este socio
                  </FormLabel>
                </div>
              </FormItem>
            )}
          />

          {isObserved && (
            <FormField
              control={form.control}
              name="payment_observation_detail"
              render={({ field }) => (
                <FormItem className="mt-4 animate-in zoom-in-95 duration-200">
                  <FormControl>
                    <Textarea 
                      placeholder="Describa el motivo de la observación del socio..."
                      className="min-h-[80px] bg-white border-amber-100 rounded-xl focus:ring-amber-500/20 font-medium text-amber-900"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose} 
            className="flex-1 h-14 rounded-xl font-bold border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <X className="h-4 w-4 mr-2" /> Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className={cn(
              "flex-1 h-14 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95",
              transactionType === 'Anulación' ? "bg-red-600 hover:bg-red-700 shadow-red-100" :
              (transactionType === 'Devolución' || transactionType === 'Gasto') ? "bg-amber-600 hover:bg-amber-700 shadow-amber-100" :
              "bg-[#4892CC] hover:bg-[#3C8B93] shadow-sky-100"
            )}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Confirmar Registro</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
