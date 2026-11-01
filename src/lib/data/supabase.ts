// Client do Supabase usado pelo backend (API Routes e Server Components).
// Usa a service role: ignora o RLS, então NUNCA deve ser importado no navegador —
// toda autorização acontece no backend antes de chegar aqui.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const g = globalThis as unknown as { __lojaflowSupabase?: SupabaseClient };

/** Criado sob demanda para o build não exigir as variáveis de ambiente. */
export function supabase() {
  if (g.__lojaflowSupabase) return g.__lojaflowSupabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  return (g.__lojaflowSupabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}

export const MEDIA_BUCKET = "media"; // público: fotos da loja e dos produtos
export const RECEIPTS_BUCKET = "receipts"; // privado: comprovantes de pagamento
