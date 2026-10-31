import Link from "next/link";
import { Download } from "lucide-react";
import { ProviderIcon } from "@/components/store/login-panel";
import { Badge, ButtonLink, Card, PageHeader, StatCard, Table } from "@/components/ui";
import { loadStore } from "@/lib/data/load-store";
import { listCustomers } from "@/lib/data/repository";
import { date, money } from "@/lib/format";
import { segment, vipThreshold } from "@/lib/segments";

export const metadata = { title: "Clientes" };

export default async function CustomersPage({ params }: { params: Promise<{ loja: string }> }) {
  const store = await loadStore((await params).loja);
  const customers = await listCustomers(store.id);
  const buyers = customers.filter((c) => c.orders > 0);
  const ltv = buyers.length ? buyers.reduce((s, c) => s + c.spent, 0) / buyers.length : 0;
  const repeat = buyers.length ? (buyers.filter((c) => c.orders > 1).length / buyers.length) * 100 : 0;
  const optIn = customers.filter((c) => c.marketingOptIn).length;
  const vip = vipThreshold(customers);
  const exportUrl = `/api/stores/${store.slug}/customers/export`;

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Dados do cadastro, consentimentos (LGPD) e segmentação automática."
        action={
          <div className="flex gap-2">
            <ButtonLink href={`${exportUrl}?marketing=1`} variant="outline" prefetch={false}>
              <Download className="size-4" /> Lista de marketing
            </ButtonLink>
            <ButtonLink href={exportUrl} prefetch={false}>
              <Download className="size-4" /> Exportar CSV
            </ButtonLink>
          </div>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes" value={String(customers.length)} hint={`${buyers.length} compradores`} />
        <StatCard label="LTV médio" value={money(ltv)} hint="gasto médio por cliente" />
        <StatCard label="Taxa de recompra" value={`${repeat.toFixed(0)}%`} hint="compraram 2+ vezes" />
        <StatCard label="Aceitam marketing" value={`${optIn}`} hint={`${customers.length ? Math.round((optIn / customers.length) * 100) : 0}% da base`} />
      </div>
      <Card>
        <Table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>CPF / Telefone</th>
              <th>Cidade</th>
              <th>Segmento</th>
              <th>Pedidos</th>
              <th>Última compra</th>
              <th className="text-right">Total gasto</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const s = segment(c, vip);
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/${store.slug}/painel/clientes/${c.id}`} className="flex items-center gap-1.5 font-medium hover:underline">
                      {c.name} {c.provider && <ProviderIcon provider={c.provider} className="size-3.5" />}
                    </Link>
                    <p className="text-xs text-zinc-400">{c.email}</p>
                  </td>
                  <td className="text-zinc-500">
                    <p className="font-mono text-xs">{c.cpf ?? "—"}</p>
                    <p className="text-xs">{c.phone || "—"}</p>
                  </td>
                  <td className="text-zinc-500">{c.city}</td>
                  <td>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </td>
                  <td>{c.orders}</td>
                  <td className="text-zinc-500">{c.lastOrderAt ? date(c.lastOrderAt) : "—"}</td>
                  <td className="text-right font-medium">{money(c.spent)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
