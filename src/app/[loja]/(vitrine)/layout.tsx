import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { loadStore } from "@/lib/data/load-store";
import Link from "next/link";
import { AtSign, MessageCircle } from "lucide-react";
import { StoreLogo } from "@/components/media";
import { CartProvider } from "@/components/cart";
import { StoreHeader } from "@/components/store/store-header";

export default async function VitrineLayout({ children, params }: { children: React.ReactNode; params: Promise<{ loja: string }> }) {
  const store = await loadStore((await params).loja);
  const user = await getSessionUser();

  if (store.status === "suspended") {
    return (
      <main className="vitrine grid min-h-screen place-items-center px-6 text-center">
        <div aria-hidden className="vitrine-scene" />
        <div className="glass rounded-[32px] px-10 py-12">
          <StoreLogo store={store} className="mx-auto size-20 rounded-3xl" emojiClassName="text-5xl" />
          <h1 className="mt-5 text-2xl font-light tracking-tight">{store.name}</h1>
          <p className="mt-2 text-sm text-zinc-500">Esta loja está temporariamente indisponível. Volte em breve!</p>
        </div>
      </main>
    );
  }

  return (
    <CartProvider storeSlug={store.slug}>
      <div className="vitrine flex min-h-screen flex-col">
        <div aria-hidden className="vitrine-scene" />
        <Suspense>
          <StoreHeader slug={store.slug} name={store.name} logo={store.logo} logoUrl={store.logoUrl} userName={user?.name ?? null} />
        </Suspense>
        <div className="flex-1">{children}</div>
        {store.whatsapp && (
          <a
            href={`https://wa.me/55${store.whatsapp}?text=${encodeURIComponent(`Olá! Vim pela loja ${store.name}.`)}`}
            target="_blank"
            rel="noreferrer"
            className="store-wa-fab pdp-icon-btn fixed bottom-5 right-5 z-30 size-12 transition hover:scale-105"
            aria-label="Falar no WhatsApp"
          >
            <MessageCircle className="size-5 text-[#4ade80]" />
          </a>
        )}
        <footer className="store-footer mx-auto mt-24 w-full max-w-[1512px] px-5 pb-6 sm:mt-32 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-[var(--pdp-line)] pt-6 text-[13px] text-white/60">
            <span>
              © {new Date().getFullYear()} {store.name}
            </span>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {store.instagram && (
                <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-white">
                  <AtSign className="size-3.5" /> {store.instagram}
                </a>
              )}
              <Link href={`/${store.slug}/termos`} className="hover:text-white">
                Termos de Uso
              </Link>
              <Link href={`/${store.slug}/privacidade`} className="hover:text-white">
                Privacidade
              </Link>
              <Link href="/" className="hover:text-white">
                Feito com LojaFlow
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
