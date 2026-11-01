import Link from "next/link";
import { StoreLogo } from "@/components/media";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { StoreAdminActions } from "@/components/backoffice/store-admin-actions";
import { DeleteStoreCard, StoreEditForm } from "@/components/backoffice/store-edit-form";
import { RevenueChart } from "@/components/charts";
import { ButtonLink, Card, CardHeader, InsightList, StatCard, StoreStatusBadge } from "@/components/ui";
import { getPlan, getStoreBySlug, listAudit, listCustomers, listPlans, listProducts, storeMetrics } from "@/lib/data/repository";
import { date, dateTime, money } from "@/lib/format";
import { storeInsights } from "@/lib/insights";

export default async function StoreAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const store = await getStoreBySlug((await params).slug);
  if (!store) notFound();
  const [m, plans, plan, products, customers, audit, insights] = await Promise.all([
    storeMetrics(store.id),
    listPlans(),
    getPlan(store.planId),
    listProducts(store.id, { includeInactive: true }),
    listCustomers(store.id),
    listAudit(),
    storeInsights(store),
  ]);
  const fee = (m.revenue * plan.feePercent) / 100;
  const history = audit.filter((a) => a.target === store.slug);

  return (
    <>
      <Link href="/backoffice/lojas" className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ChevronLeft className="size-4" /> Lojas
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <StoreLogo store={store} tinted className="size-14 rounded-2xl" emojiClassName="text-3xl" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{store.name}</h1>
            <StoreStatusBadge status={store.status} />
          </div>
          <p className="text-sm text-zinc-500">
            /{store.slug} · {store.ownerName} ({store.ownerEmail}) · desde {date(store.createdAt)}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <ButtonLink href={`/${store.slug}/home`} target="_blank" variant="outline">
            <ExternalLink className="size-4" /> Vitrine
          </ButtonLink>
          <ButtonLink href={`/${store.slug}/painel`} target="_blank" variant="outline">
            <ExternalLink className="size-4" /> Painel do dono
          </ButtonLink>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="GMV 30d" value={money(m.revenue)} growth={m.revenueGrowth} />
        <StatCard label="Receita p/ plataforma" value={money(plan.priceMonthly + fee)} hint={`${money(plan.priceMonthly)} plano + ${money(fee)} taxas`} />
        <StatCard label="Pedidos 30d" value={String(m.orders)} growth={m.ordersGrowth} />
        <StatCard label="Catálogo" value={`${products.length} produtos`} hint={`${customers.length} clientes`} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Vendas diárias" />
            <div className="p-4">
              <RevenueChart data={m.series} color={store.brandColor} />
            </div>
          </Card>
          <StoreEditForm key={`${store.slug}:${store.ownerEmail}:${store.name}`} store={store} />
          <InsightList insights={insights} />
        </div>
        <div className="space-y-6">
          <StoreAdminActions store={store} plans={plans} />
          <Card>
            <CardHeader title="Histórico" />
            {history.length === 0 ? (
              <p className="px-5 py-6 text-sm text-zinc-500">Sem eventos.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="px-5 py-3">
                    <p>{h.action}</p>
                    <p className="text-xs text-zinc-400">
                      {h.actor} · {dateTime(h.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <DeleteStoreCard store={store} />
        </div>
      </div>
    </>
  );
}
