import type { CSSProperties } from "react";
import { loadStore } from "@/lib/data/load-store";

// Raiz de cada tenant: resolve a loja pelo slug e injeta a cor da marca.
export default async function StoreRootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ loja: string }> }) {
  const store = await loadStore((await params).loja);
  return <div style={{ "--brand": store.brandColor } as CSSProperties}>{children}</div>;
}
