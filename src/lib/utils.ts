import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amount)
}

/**
 * Calcula el estado del socio basado en su última transacción
 */
export function getSocioStatus(lastTransactionType: string | null, amount: number) {
  if (!lastTransactionType) return { label: 'Activo', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  
  const type = lastTransactionType.toLowerCase();
  
  if (type.includes('devolución') || type.includes('retirado')) {
    return { label: 'Retirado', color: 'bg-red-50 text-red-700 border-red-100' };
  }
  
  if (type.includes('anulación') || type.includes('anulado')) {
    return { label: 'Inactivo', color: 'bg-slate-100 text-slate-600 border-slate-200' };
  }

  if (amount > 0) {
    return { label: 'Activo', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  }

  return { label: 'Activo', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
}

/**
 * Ordenamiento alfanumérico para números de recibo (ej: B001-0001)
 */
export const sortReceipts = (rowA: any, rowB: any, columnId: string) => {
  const a = String(rowA.getValue(columnId) || "");
  const b = String(rowB.getValue(columnId) || "");
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

/**
 * Ordenamiento por nombre completo
 * Se usa _columnId para evitar el error TS6133 ya que la lógica es personalizada
 */
export const sortNames = (rowA: any, rowB: any, _columnId: string) => {
  const a = `${rowA.original.nombres} ${rowA.original.apellidoPaterno}`.toLowerCase();
  const b = `${rowB.original.nombres} ${rowB.original.apellidoPaterno}`.toLowerCase();
  return a.localeCompare(b);
};
