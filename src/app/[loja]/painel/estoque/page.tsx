import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { StockManager, type StockRow } from "@/components/painel/stock-manager";
import { Card, CardHeader, PageHeader, StatCard, Table, cn } from "@/components/ui";
import { loadStore } from "@/lib/data/load-store";
import { listProducts, listStockMovements } from "@/lib/data/repository";
import { dateTime, money, stockReasonLabel } from "@/lib/format";
import { priceOf, stockLevel, variantLabel } from "@/lib/pricing";

export const metadata = { title: "Estoque" };

export default async function StockPage({ params }: { params: Promise<{ loja: string }> }) {
  const { loja } = await params;
  const store = await loadStore(loja);
  const [products, movements] = await Promise.all([listProducts(store.id, { includeInactive: true }), listStockMovements(store.id, { limit: 60 })]);

  // uma linha por SKU vendável: o produto, ou cada uma das suas variações
  const rows: StockRow[] = products.flatMap((p) =>
    (p.variants.length ? p.variants : [null]).map((v) => ({
      key: `${p.id}:${v?.id ?? ""}`,
      productId: p.id,
      variantId: v?.id ?? null,
      name: p.name,
      variant: v ? variantLabel(v) : null,
      sku: v?.sku || p.sku,
      imageUrl: p.images[0] ?? null,
      emoji: p.image,
      stock: v ? v.stock : p.stock,
      threshold: p.lowStockThreshold,
      price: priceOf(p, v).regular,
      level: stockLevel(v ? v.stock : p.stock, p.lowStockThreshold, p.trackStock),
    })),
  );
  const tracked = rows.filter((r) => r.level !== "untracked");
  const units = tracked.reduce((s, r) => s + r.stock, 0);
  const value = tracked.reduce((s, r) => s + r.stock * r.price, 0);
  const productById = Object.fromEntries(products.map((p) => [p.id, p]));

  return (
    <>
      <PageHeader title="Estoque" description="Controle por produto e por variação (tamanho, cor, peso, voltagem…)." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="SKUs controlados" value={String(tracked.length)} hint={`${rows.length - tracked.length} sem controle (sob encomenda)`} />
        <StatCard label="Unidades" value={units.toLocaleString("pt-BR")} hint="em estoque" />
        <StatCard label="Valor em estoque" value={money(value)} hint="a preço de venda" />
        <StatCard label="Atenção" value={`${tracked.filter((r) => r.level === "out").length} esgotados`} hint={`${tracked.filter((r) => r.level === "low").length} com estoque baixo`} />
      </div>
      <StockManager slug={loja} rows={rows} />

      <Card className="mt-6">
        <CardHeader title="Movimentações recentes" description="Vendas, cancelamentos, entradas e ajustes" />
        <Table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Produto</th>
              <th>Motivo</th>
              <th className="text-right">Qtd.</th>
              <th className="text-right">Saldo</th>
              <th>Por</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => {
              const p = productById[m.productId];
              const v = p?.variants.find((x) => x.id === m.variantId);
              return (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-zinc-500">{dateTime(m.at)}</td>
                  <td>
                    {p ? (
                      <Link href={`/${loja}/painel/produtos/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">Produto excluído</span>
                    )}
                    {v && <span className="text-zinc-500"> · {variantLabel(v)}</span>}
                    {m.note && <p className="text-xs text-zinc-400">{m.note}</p>}
                  </td>
                  <td className="text-zinc-600">{stockReasonLabel[m.reason]}</td>
                  <td className={cn("text-right font-medium tabular-nums", m.delta > 0 ? "text-emerald-600" : "text-red-600")}>
                    <span className="inline-flex items-center">
                      {m.delta > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{m.balanceAfter}</td>
                  <td className="text-xs text-zinc-500">{m.actor}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
