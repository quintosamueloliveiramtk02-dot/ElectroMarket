import { createClient } from '@supabase/supabase-js';

// Essas variáveis serão puxadas do ambiente (configuradas na Vercel ou localmente)
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão definidas no ambiente.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
