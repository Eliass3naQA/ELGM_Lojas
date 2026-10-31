import Link from "next/link";
import { StoreLogo } from "@/components/media";
import { Coins, Repeat, ShoppingBag, Store } from "lucide-react";
import { Donut, HorizontalBars, RevenueChart } from "@/components/charts";
import { Card, CardHeader, CardLink, Growth, InsightList, PageHeader, StatCard, StoreStatusBadge, Table } from "@/components/ui";
import { platformMetrics } from "@/lib/data/repository";
import { money, pct } from "@/lib/format";
import { platformInsights } from "@/lib/insights";

export default async function BackofficeHome() {
  const [m, insights] = await Promise.all([platformMetrics(), platformInsights()]);
  return (
    <>
      <PageHeader eyebrow="Plataforma · últimos 30 dias" title="Visão geral de todas as lojas." description="GMV, receita recorrente e saúde das lojas em tempo real." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard accent label="GMV" value={money(m.gmv)} growth={m.gmvGrowth} hint="vendido pelas lojas" icon={<ShoppingBag />} />
        <StatCard label="MRR" value={money(m.mrr)} hint={`ARR ${money(m.arr)}`} icon={<Repeat />} />
        <StatCard label="Receita de taxas" value={money(m.feeRevenue)} hint="take rate sobre GMV" icon={<Coins />} />
        <StatCard label="Lojas" value={String(m.stores)} hint={`${m.statusCount.active} ativas · ${m.statusCount.trial} trial · ${m.statusCount.suspended} suspensas`} icon={<Store />} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="GMV diário" description={`${m.orders} pedidos · ${pct(m.ordersGrowth)} vs. período anterior`} />
          <div className="px-3 pb-4 pt-2">
            <RevenueChart data={m.series} />
          </div>
        </Card>
        <InsightList insights={insights} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Ranking de lojas" action={<CardLink href="/backoffice/lojas">Ver todas</CardLink>} />
          <Table>
            <thead>
              <tr>
                <th>Loja</th>
                <th>Status</th>
                <th>Pedidos</th>
                <th>Crescimento</th>
                <th className="text-right">GMV</th>
              </tr>
            </thead>
            <tbody>
              {m.perStore.map((r) => (
                <tr key={r.store.id}>
                  <td>
                    <Link href={`/backoffice/lojas/${r.store.slug}`} className="flex items-center gap-3 font-medium text-zinc-900">
                      <StoreLogo store={r.store} tinted className="size-9 rounded-full ring-1 ring-white" emojiClassName="text-base" /> {r.store.name}
                    </Link>
                  </td>
                  <td>
                    <StoreStatusBadge status={r.store.status} />
                  </td>
                  <td className="tabular-nums">{r.orders}</td>
                  <td>
                    <Growth value={r.growth} />
                  </td>
                  <td className="text-right font-semibold tabular-nums">{money(r.gmv)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Lojas por plano" />
            <div className="px-6 pb-6 pt-3">
              <Donut data={m.planMix.map((p) => ({ name: p.plan, value: p.stores }))} centerLabel="lojas" />
            </div>
          </Card>
          <Card>
            <CardHeader title="GMV por loja" description="Top 5" />
            <div className="px-6 pb-6 pt-3">
              <HorizontalBars data={m.perStore.slice(0, 5).map((r) => ({ name: r.store.name, value: r.gmv }))} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
