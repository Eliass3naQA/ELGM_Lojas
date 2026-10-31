import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { loadStore } from "@/lib/data/load-store";
import Link from "next/link";
import { AtSign, MessageCircle } from "lucide-react";
import { StoreLogo } from "@/components/media";
import { CartProvider } from "@/components/cart";
import { Scene } from "@/components/scene";
import { StoreHeader } from "@/components/store/store-header";

export default async function VitrineLayout({ children, params }: { children: React.ReactNode; params: Promise<{ loja: string }> }) {
  const store = await loadStore((await params).loja);
  const user = await getSessionUser();

  if (store.status === "suspended") {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <Scene variant="daylight" />
        <div className="glass rounded-[32px] px-10 py-12">
          <StoreLogo store={store} className="mx-auto size-20 rounded-3xl" emojiClassName="text-5xl" />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{store.name}</h1>
          <p className="mt-2 text-sm text-zinc-500">Esta loja está temporariamente indisponível. Volte em breve!</p>
        </div>
      </main>
    );
  }

  return (
    <CartProvider storeSlug={store.slug}>
      <Scene variant="daylight" imageUrl={store.coverUrl} />
      <div className="flex min-h-screen flex-col">
        <Suspense>
          <StoreHeader slug={store.slug} name={store.name} logo={store.logo} logoUrl={store.logoUrl} userName={user?.name ?? null} />
        </Suspense>
        <div className="flex-1">{children}</div>
        {store.whatsapp && (
          <a
            href={`https://wa.me/55${store.whatsapp}?text=${encodeURIComponent(`Olá! Vim pela loja ${store.name}.`)}`}
            target="_blank"
            rel="noreferrer"
            className="fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_-8px_rgb(37_211_102/0.7)] ring-4 ring-white/60 transition hover:scale-105"
            aria-label="Falar no WhatsApp"
          >
            <MessageCircle className="size-6" />
          </a>
        )}
        <footer className="mx-auto mt-20 w-full max-w-7xl px-3 pb-4 sm:px-6">
          <div className="glass rounded-[30px]">
            {(store.about || store.instagram) && (
              <div className="flex flex-wrap items-start gap-6 px-6 pt-8 sm:px-8">
                <StoreLogo store={store} className="size-14 rounded-2xl ring-1 ring-white" emojiClassName="text-2xl" />
                <div className="min-w-60 flex-1">
                  <p className="font-semibold tracking-tight">Sobre a {store.name}</p>
                  {store.about && <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-600">{store.about}</p>}
                </div>
                {store.instagram && (
                  <a
                    href={`https://instagram.com/${store.instagram}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-white"
                  >
                    <AtSign className="size-4" /> @{store.instagram}
                  </a>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-zinc-500 sm:px-8">
              <span>
                © {new Date().getFullYear()} {store.name}
              </span>
              <div className="flex gap-4">
                <Link href={`/${store.slug}/termos`} className="hover:text-zinc-900">
                  Termos de Uso
                </Link>
                <Link href={`/${store.slug}/privacidade`} className="hover:text-zinc-900">
                  Privacidade
                </Link>
                <Link href="/" className="hover:text-zinc-900">
                  Feito com LojaFlow
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
