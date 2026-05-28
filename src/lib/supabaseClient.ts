import { createClient } from '@supabase/supabase-js';

// Essas variáveis serão puxadas do ambiente (configuradas na Vercel ou localmente)
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Atenção: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão definidas no seu ambiente.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project-id.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
