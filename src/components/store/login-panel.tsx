"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FlaskConical, Loader2, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { authProviders } from "@/lib/auth/providers";
import type { AuthProvider } from "@/lib/types";
import { Button, Card, Field, Input } from "../ui";

export function ProviderIcon({ provider, className = "size-5" }: { provider: AuthProvider; className?: string }) {
  if (provider === "google")
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
    );
  if (provider === "microsoft")
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="#F25022" d="M1 1h10v10H1z" />
        <path fill="#7FBA00" d="M13 1h10v10H13z" />
        <path fill="#00A4EF" d="M1 13h10v10H1z" />
        <path fill="#FFB900" d="M13 13h10v10H13z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.96-.74 1.39 0 1.78.74 2.99.72 1.24-.02 2.02-1.12 2.77-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.65zM14.1 5.86c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.27z" />
    </svg>
  );
}

export function LoginPanel({ slug, storeName, next }: { slug: string; storeName: string; next: string }) {
  const router = useRouter();
  const [provider, setProvider] = useState<AuthProvider | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/mock-oauth", "POST", { provider, email: f.get("email"), name: f.get("name") });
      const me = await api<{ complete: boolean }>(`/api/stores/${slug}/me`);
      router.push(me.complete ? next : `/${slug}/cadastro?next=${encodeURIComponent(next)}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <>
      <Card className="p-6 sm:p-8">
        <h1 className="text-center text-2xl font-semibold tracking-tight">Entrar na {storeName}</h1>
        <p className="mt-1 text-center text-sm text-zinc-500">Use sua conta para comprar e acompanhar pedidos.</p>
        <div className="mt-8 space-y-3">
          {(Object.keys(authProviders) as AuthProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setProvider(p);
                setError(null);
              }}
              className={
                p === "apple"
                  ? "flex w-full items-center justify-center gap-3 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
                  : "flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
              }
            >
              <ProviderIcon provider={p} /> Continuar com {authProviders[p].label}
            </button>
          ))}
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-zinc-400">
          Ao continuar, você concorda com os{" "}
          <Link href={`/${slug}/termos`} className="underline hover:text-zinc-600">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href={`/${slug}/privacidade`} className="underline hover:text-zinc-600">
            Política de Privacidade
          </Link>
          .
        </p>
      </Card>

      {provider && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => !loading && setProvider(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
              <FlaskConical className="size-3.5" /> Simulação: em produção abre a tela oficial de login
              <button onClick={() => setProvider(null)} className="ml-auto rounded p-0.5 hover:bg-amber-100" aria-label="Fechar">
                <X className="size-3.5" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4 p-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <ProviderIcon provider={provider} className="size-8" />
                <p className="font-semibold">Fazer login com {authProviders[provider].label}</p>
                <p className="text-xs text-zinc-500">para continuar em {storeName}</p>
              </div>
              <Field label="E-mail" hint={`Aceita: ${authProviders[provider].domains.join(", ")}`}>
                <Input name="email" type="email" required autoFocus placeholder={authProviders[provider].example} />
              </Field>
              <Field label="Nome">
                <Input name="name" required autoComplete="name" />
              </Field>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />} Continuar
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
