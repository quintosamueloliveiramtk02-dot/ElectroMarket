import { createClient } from '@supabase/supabase-js';

// Obter as variáveis de ambiente com prefixo VITE_ para uso no front-end
const supabaseUrl = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || '';

// Se as chaves ainda não estiverem configuradas no painel de segredos/ambiente, 
// criamos uma instância básica ou exportamos null para tratamento elegante na UI.
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://your-project-id.supabase.co');

if (!isConfigured) {
  console.warn(
    '[Supabase] Atenção: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão configuradas. ' +
    'Por favor, configure as variáveis de ambiente para conectar-se ao seu projeto real.'
  );
}

// Instância do cliente Supabase para consultas, autenticação e real-time
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project-id.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export const hasSupabaseConfig = isConfigured;
