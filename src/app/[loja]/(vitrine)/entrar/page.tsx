import { redirect } from "next/navigation";
import { LoginPanel } from "@/components/store/login-panel";
import { safeNext } from "@/lib/auth/redirect";
import { getSessionUser } from "@/lib/auth/session";
import { loadStore } from "@/lib/data/load-store";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ params, searchParams }: { params: Promise<{ loja: string }>; searchParams: Promise<{ next?: string }> }) {
  const store = await loadStore((await params).loja);
  const next = safeNext(store.slug, (await searchParams).next);
  if (await getSessionUser()) redirect(next);
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <LoginPanel slug={store.slug} storeName={store.name} next={next} />
    </main>
  );
}
