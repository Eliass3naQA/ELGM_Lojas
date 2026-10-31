import Link from "next/link";
import { loadStore } from "@/lib/data/load-store";
import { DollarSign, Receipt, ShoppingCart, Users } from "lucide-react";
import { Donut, RevenueChart } from "@/components/charts";
import { Thumb } from "@/components/media";
import { Avatar, ButtonLink, Card, CardHeader, CardLink, InsightList, OrderStatusBadge, PageHeader, StatCard } from "@/components/ui";
import { listCustomers, listOrders, listProducts, storeMetrics } from "@/lib/data/repository";
import { dateTime, money, paymentLabel } from "@/lib/format";
import { storeInsights } from "@/lib/insights";

export const metadata = { title: "Painel" };

export default async function PainelHome({ params }: { params: Promise<{ loja: string }> }) {
  const store = await loadStore((await params).loja);
  const [m, insights, orders, customers, products] = await Promise.all([
    storeMetrics(store.id),
    storeInsights(store),
    listOrders({ storeId: store.id }),
    listCustomers(store.id),
    listProducts(store.id),
  ]);
  const customerName = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const photo = Object.fromEntries(products.map((p) => [p.id, p.images[0] ?? null]));
  const base = `/${store.slug}/painel`;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const topQty = Math.max(1, ...m.topProducts.map((p) => p.qty));

  return (
    <>
      <PageHeader
        eyebrow={`${greeting}, ${store.ownerName.split(" ")[0]}`}
        title="Aqui está a visão do seu negócio."
        description="Acompanhe vendas, pedidos e clientes dos últimos 30 dias."
        action={
          <>
            <ButtonLink href={`${base}/pedidos`} variant="outline">
              Ver pedidos
            </ButtonLink>
            <ButtonLink href={`${base}/produtos/novo`}>Novo produto</ButtonLink>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard accent label="Faturamento" value={money(m.revenue)} growth={m.revenueGrowth} hint="vs. 30 dias antes" icon={<DollarSign />} />
        <StatCard label="Pedidos" value={String(m.orders)} growth={m.ordersGrowth} hint="vs. 30 dias antes" icon={<ShoppingCart />} />
        <StatCard label="Ticket médio" value={money(m.avgTicket)} hint={`antes ${money(m.prevAvgTicket)}`} icon={<Receipt />} />
        <StatCard label="Compradores" value={String(m.customers)} hint={`${customers.length} na base`} icon={<Users />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Faturamento diário" description="Pedidos não cancelados · passe o mouse para ver cada dia" />
          <div className="px-3 pb-4 pt-2">
            <RevenueChart data={m.series} color={store.brandColor} />
          </div>
        </Card>
        <InsightList insights={insights} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Últimos pedidos" action={<CardLink href={`${base}/pedidos`} />} />
          <ul className="space-y-1 px-3 pb-3">
            {orders.slice(0, 6).map((o) => (
              <li key={o.id}>
                <Link href={`${base}/pedidos/${o.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-white/55">
                  <Avatar name={customerName[o.customerId] ?? "?"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{customerName[o.customerId]}</p>
                    <p className="truncate text-xs text-zinc-500">
                      #{o.number} · {dateTime(o.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums text-zinc-900">{money(o.total)}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Mais vendidos" description="Por faturamento no período" action={<CardLink href={`${base}/produtos`} />} />
          <ul className="space-y-1 px-3 pb-3">
            {m.topProducts.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/80 text-[11px] font-semibold text-zinc-600 shadow-sm">{i + 1}</span>
                <Thumb url={photo[p.id]} emoji={p.image} alt={p.name} className="size-12 rounded-2xl ring-1 ring-white" emojiClassName="text-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-900/[0.07]">
                      <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(p.qty / topQty) * 100}%` }} />
                    </div>
                    <span className="text-[11px] tabular-nums text-zinc-500">{p.qty} un.</span>
                  </div>
                </div>
              </li>
            ))}
            {m.topProducts.length === 0 && <li className="px-3 py-8 text-center text-sm text-zinc-500">Ainda sem vendas no período.</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Formas de pagamento" description="Pedidos do período" />
          <div className="px-6 pb-6 pt-3">
            <Donut data={m.paymentMix.map((x) => ({ name: paymentLabel[x.method], value: x.count }))} centerLabel="pedidos" />
          </div>
        </Card>
      </div>
    </>
  );
}
