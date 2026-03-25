import { useState } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Wallet,
  ChevronLeft,
  ChevronRight,
  ArrowUpCircle,
  ArrowDownCircle,
  UserCheck,
  Settings as SettingsIcon,
  Loader2,
  FolderOpen,
  FileText,
  Clock,
  Menu,
  LogOut,
  Package,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/lib/supabaseClient';
import NotificationBell from '@/components/ui/NotificationBell';

function DashboardLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, roles, loading } = useUser();

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-white">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  const navItems = [
    { name: 'Resumen', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Ingresos', path: '/income', icon: ArrowUpCircle },
    { name: 'Gastos', path: '/expenses', icon: ArrowDownCircle },
    { name: 'Titulares', path: '/people', icon: UserCheck },
    { name: 'Documentos', path: '/partner-documents', icon: FolderOpen },
    { name: 'Facturación', path: '/invoicing', icon: FileText },
    { name: 'Jornada', path: '/jornada', icon: Clock },
    { name: 'Inventario', path: '/inventory', icon: Package },
    { name: 'Cuentas', path: '/accounts', icon: Wallet },
    { name: 'Configuración', path: '/settings', icon: SettingsIcon },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#FAFAFA] border-r border-[#E5E7EB]/60">
      <div className="p-6 md:p-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
            <Wallet className="text-white w-5 h-5" />
          </div>
          {!isCollapsed && (
            <span className="text-xl md:text-2xl font-black tracking-tighter text-slate-800">
              Fin<span className="text-primary">Dash</span>
            </span>
          )}
        </Link>
      </div>

      <ScrollArea className="flex-1 px-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group relative",
                  isActive 
                    ? "bg-white text-primary font-bold shadow-sm border border-slate-100/60" 
                    : "text-slate-500 hover:bg-slate-100/50 hover:text-slate-800"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                )}
                <item.icon className={cn("w-[22px] h-[22px]", isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-600")} strokeWidth={isActive ? 2.5 : 2} />
                {!isCollapsed && <span className="tracking-tight">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-4 mt-auto border-t border-slate-200/60">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors font-medium"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate('/auth');
          }}
        >
          <LogOut className="w-[22px] h-[22px]" strokeWidth={2} />
          {!isCollapsed && <span>Cerrar Sesión</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans">
      <aside className={cn(
        "hidden lg:block transition-all duration-300 ease-in-out relative z-40",
        isCollapsed ? "w-20" : "w-[280px]"
      )}>
        <SidebarContent />
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-[72px] bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 md:px-8 flex items-center justify-between z-30 sticky top-0">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden hover:bg-slate-100 rounded-xl" 
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="hidden lg:flex text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </Button>
          </div>

          <div className="flex items-center gap-5">
            <NotificationBell />
            <div className="h-6 w-[1px] bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800 leading-none tracking-tight">{user?.email?.split('@')[0]}</p>
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1">{roles?.[0] || 'Usuario'}</p>
              </div>
              <Avatar className="h-9 w-9 border border-slate-200 shadow-sm transition-transform hover:scale-105 cursor-pointer">
                <AvatarImage src="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" />
                <AvatarFallback className="bg-primary text-white font-bold text-xs">JD</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] shadow-premium transition-transform transform">
            <SidebarContent />
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardLayout;
