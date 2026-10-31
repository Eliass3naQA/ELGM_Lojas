import type { AuthProvider } from "../types";

// Na simulação validamos o domínio do e-mail para cada provedor.
// Com Supabase Auth: signInWithOAuth({ provider: "google" | "azure" | "apple" }).
export const authProviders: Record<AuthProvider, { label: string; domains: string[]; supabaseId: string; example: string }> = {
  google: { label: "Google", domains: ["gmail.com", "googlemail.com"], supabaseId: "google", example: "voce@gmail.com" },
  microsoft: {
    label: "Microsoft",
    domains: ["hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br", "live.com", "msn.com"],
    supabaseId: "azure",
    example: "voce@hotmail.com",
  },
  apple: { label: "Apple", domains: ["icloud.com", "me.com", "mac.com"], supabaseId: "apple", example: "voce@icloud.com" },
};

export function emailMatchesProvider(email: string, provider: AuthProvider) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return authProviders[provider].domains.includes(domain);
}
