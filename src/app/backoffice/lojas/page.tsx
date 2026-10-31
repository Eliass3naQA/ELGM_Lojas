import Link from "next/link";
import { StoreLogo } from "@/components/media";
import { Plus } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, Input, PageHeader, StoreStatusBadge, Table, cn } from "@/components/ui";
import { listPlans, platformMetrics } from "@/lib/data/repository";
import { date, money, pct, storeStatusLabel } from "@/lib/format";
import type { StoreStatus } from "@/lib/types";

export const metadata = { title: "Lojas" };

export default async function StoresPage({ searchParams }: { searchParams: Promise<{ status?: StoreStatus; q?: string }> }) {
  const { status, q } = await searchParams;
  const [m, plans] = await Promise.all([platformMetrics(), listPlans()]);
  const planName = Object.fromEntries(plans.map((p) => [p.id, p.name]));
  const rows = m.perStore.filter(
    (r) => (!status || r.store.status === status) && (!q || `${r.store.name} ${r.store.slug} ${r.store.ownerEmail}`.toLowerCase().includes(q.toLowerCase())),
  );
  const tabs: (StoreStatus | undefined)[] = [undefined, "active", "trial", "suspended"];

  return (
    <>
      <PageHeader
        title="Lojas"
        description={`${m.stores} lojas cadastradas na plataforma.`}
        action={
          <ButtonLink href="/backoffice/lojas/nova">
            <Plus className="size-4" /> Nova loja
          </ButtonLink>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
          {tabs.map((t) => (
            <Link
              key={t ?? "all"}
              href={t ? `/backoffice/lojas?status=${t}` : "/backoffice/lojas"}
              className={cn("rounded-lg px-3 py-1.5 text-sm transition", status === t ? "bg-white font-medium shadow-sm" : "text-zinc-500 hover:text-zinc-900")}
            >
              {t ? storeStatusLabel[t] : "Todas"}
            </Link>
          ))}
        </div>
        <form className="ml-auto w-full max-w-xs">
          {status && <input type="hidden" name="status" value={status} />}
          <Input name="q" defaultValue={q} placeholder="Buscar por nome, slug ou e-mail…" />
        </form>
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Nenhuma loja encontrada" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Loja</th>
                <th>Dono</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Produtos</th>
                <th>GMV 30d</th>
                <th>Desde</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.store.id}>
                  <td>
                    <Link href={`/backoffice/lojas/${r.store.slug}`} className="flex items-center gap-3 hover:underline">
                      <StoreLogo store={r.store} tinted className="size-9 rounded-lg" emojiClassName="text-lg" />
                      <span>
                        <span className="block font-medium">{r.store.name}</span>
                        <span className="block text-xs text-zinc-400">/{r.store.slug}</span>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <p>{r.store.ownerName}</p>
                    <p className="text-xs text-zinc-400">{r.store.ownerEmail}</p>
                  </td>
                  <td>
                    <Badge tone="violet">{planName[r.store.planId]}</Badge>
                  </td>
                  <td>
                    <StoreStatusBadge status={r.store.status} />
                  </td>
                  <td>{r.products}</td>
                  <td>
                    <p className="font-medium">{money(r.gmv)}</p>
                    <p className={cn("text-xs", r.growth >= 0 ? "text-emerald-600" : "text-red-600")}>{pct(r.growth)}</p>
                  </td>
                  <td className="text-zinc-500">{date(r.store.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
