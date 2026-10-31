import { Card, PageHeader, StatCard } from "@/components/ui";
import { listPlans, platformMetrics } from "@/lib/data/repository";
import { money } from "@/lib/format";

export const metadata = { title: "Planos & receita" };

export default async function PlansPage() {
  const [plans, m] = await Promise.all([listPlans(), platformMetrics()]);
  return (
    <>
      <PageHeader title="Planos & receita" description="Assinaturas e taxas cobradas das lojas." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="MRR" value={money(m.mrr)} hint="lojas ativas" />
        <StatCard label="Taxas (30d)" value={money(m.feeRevenue)} hint={`sobre ${money(m.gmv)} de GMV`} />
        <StatCard label="Receita total (30d)" value={money(m.mrr + m.feeRevenue)} hint={`take rate efetivo ${m.gmv ? (((m.mrr + m.feeRevenue) / m.gmv) * 100).toFixed(1) : 0}%`} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const rows = m.perStore.filter((r) => r.store.planId === p.id);
          const active = rows.filter((r) => r.store.status === "active");
          const fees = rows.reduce((s, r) => s + (r.gmv * p.feePercent) / 100, 0);
          return (
            <Card key={p.id} className="p-6">
              <p className="text-lg font-semibold">{p.name}</p>
              <p className="text-sm text-zinc-500">
                {money(p.priceMonthly)}/mês · {p.feePercent}% por venda · {p.maxProducts ?? "∞"} produtos
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-zinc-500">Lojas</dt>
                  <dd className="text-xl font-semibold">{rows.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">MRR</dt>
                  <dd className="text-xl font-semibold">{money(active.length * p.priceMonthly)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-zinc-500">Taxas 30d</dt>
                  <dd className="font-medium">{money(fees)}</dd>
                </div>
              </dl>
              <ul className="mt-5 space-y-1 border-t border-zinc-100 pt-4 text-sm text-zinc-600">
                {p.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}
