import { AppShell, type NavItem } from "@/components/sidebar";
import { loadStore } from "@/lib/data/load-store";
import { listOrders, listPayments, listProducts } from "@/lib/data/repository";
import { StoreLogo } from "@/components/media";
import { Scene } from "@/components/scene";

// TODO(auth): proteger com Supabase Auth — apenas o dono (store.ownerEmail) e equipe.
export default async function PainelLayout({ children, params }: { children: React.ReactNode; params: Promise<{ loja: string }> }) {
  const store = await loadStore((await params).loja);
  const [paid, inReview] = await Promise.all([listOrders({ storeId: store.id, status: "paid" }), listPayments({ storeId: store.id, status: "in_review" })]);
  const pendingWork = paid.length + inReview.length; // comprovantes p/ analisar + pedidos p/ enviar
  // SKUs ativos esgotados (produto sem variação, ou cada variação)
  const soldOut = (await listProducts(store.id)).filter((p) => p.trackStock).flatMap((p) => (p.variants.length ? p.variants.map((v) => v.stock) : [p.stock])).filter((s) => s === 0).length;
  const base = `/${store.slug}/painel`;
  const nav: NavItem[] = [
    { href: base, label: "Visão geral", icon: "LayoutDashboard" },
    { href: `${base}/pedidos`, label: "Pedidos", icon: "ClipboardList", badge: pendingWork },
    { href: `${base}/produtos`, label: "Produtos", icon: "Boxes" },
    { href: `${base}/estoque`, label: "Estoque", icon: "Warehouse", badge: soldOut },
    { href: `${base}/promocoes`, label: "Promoções", icon: "Tag" },
    { href: `${base}/clientes`, label: "Clientes", icon: "Users" },
    { href: `${base}/configuracoes`, label: "Configurações", icon: "Settings" },
  ];

  return (
    <>
      <Scene variant="interior" />
      <AppShell
        subtitle="Painel da loja"
        nav={nav}
        footerLink={{ href: `/${store.slug}/home`, label: "Ver minha loja" }}
        user={{ name: store.ownerName, role: store.name }}
        notifications={{ count: pendingWork, href: `${base}/pedidos`, label: pendingWork ? `${pendingWork} pedido(s) aguardando você` : "Nenhuma pendência" }}
        brand={
          <div className="flex min-w-0 items-center gap-3">
            <StoreLogo store={store} className="size-10 rounded-2xl shadow-sm ring-1 ring-white" />
            <span className="brand-name truncate text-[15px] font-semibold tracking-tight text-zinc-900">{store.name}</span>
          </div>
        }
        banner={
          store.status !== "active" && (
            <div className={`mt-3 rounded-full px-5 py-2.5 text-center text-xs font-medium text-white shadow-lg lg:mt-4 ${store.status === "suspended" ? "bg-red-600/90" : "bg-sky-600/90"}`}>
              {store.status === "suspended" ? "Sua loja está suspensa e invisível para clientes. Entre em contato com o suporte." : "Você está no período de teste. Aproveite todos os recursos!"}
            </div>
          )
        }
      >
        {children}
      </AppShell>
    </>
  );
}
