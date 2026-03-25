import React from 'react';
import { cn, getSocioStatus } from '@/lib/utils';
import { UserCheck, UserMinus, UserX } from 'lucide-react';

interface SocioStatusBadgeProps {
  transactionType: string | null;
  amount: number;
  className?: string;
}

export const SocioStatusBadge: React.FC<SocioStatusBadgeProps> = ({ transactionType, amount, className }) => {
  const status = getSocioStatus(transactionType, amount);
  
  const getIcon = () => {
    switch (status.label) {
      case 'Activo': return <UserCheck className="w-3 h-3 mr-1" />;
      case 'Inactivo': return <UserMinus className="w-3 h-3 mr-1" />;
      case 'Retirado': return <UserX className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
      status.color,
      className
    )}>
      {getIcon()}
      {status.label}
    </span>
  );
};
