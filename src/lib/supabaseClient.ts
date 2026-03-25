import { createClient } from '@supabase/supabase-js';

// Limpiamos la URL para evitar problemas de formato
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'Accept': 'application/json',
    },
  },
  // Configuración de Realtime para ser más tolerante a fallos de red
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    // Si el WebSocket falla repetidamente, esto ayuda a que no sature el log
    timeout: 20000, 
  },
});
