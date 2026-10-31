import Link from "next/link";
import { loadStore } from "@/lib/data/load-store";
import { Card, EmptyState, OrderStatusBadge, PageHeader, PaymentStatusBadge, Table, cn } from "@/components/ui";
import { Thumb } from "@/components/media";
import { listCustomers, listOrders, listPayments } from "@/lib/data/repository";
import { dateTime, money, orderStatusLabel, paymentLabel } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export const metadata = { title: "Pedidos" };

// "review" = pedidos com comprovante aguardando sua análise
type Tab = OrderStatus | "review";
const tabs: (Tab | undefined)[] = [undefined, "review", "pending", "paid", "shipped", "delivered", "cancelled"];
const tabLabel = (t: Tab) => (t === "review" ? "Comprovantes p/ analisar" : t === "paid" ? "Pago — enviar" : orderStatusLabel[t]);

export default async function OrdersPage({ params, searchParams }: { params: Promise<{ loja: string }>; searchParams: Promise<{ status?: Tab }> }) {
  const { loja } = await params;
  const { status } = await searchParams;
  const store = await loadStore(loja);
  const [all, customers, payments] = await Promise.all([listOrders({ storeId: store.id }), listCustomers(store.id), listPayments({ storeId: store.id })]);
  const paymentByOrder = Object.fromEntries(payments.map((p) => [p.orderId, p]));
  const matches = (t: Tab | undefined, o: (typeof all)[number]) => !t || (t === "review" ? paymentByOrder[o.id]?.status === "in_review" : o.status === t);
  const orders = all.filter((o) => matches(status, o));
  const customerName = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const base = `/${loja}/painel/pedidos`;

  return (
    <>
      <PageHeader title="Pedidos" description="Gerencie pagamentos, envios e entregas." />
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1">
        {tabs.map((t) => {
          const count = all.filter((o) => matches(t, o)).length;
          return (
            <Link
              key={t ?? "all"}
              href={t ? `${base}?status=${t}` : base}
              className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition", status === t ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900")}
            >
              {t ? tabLabel(t) : "Todos"} <span className={cn("text-xs", t === "review" && count ? "font-semibold text-amber-600" : "text-zinc-400")}>{count}</span>
            </Link>
          );
        })}
      </div>
      <Card>
        {orders.length === 0 ? (
          <EmptyState title="Nenhum pedido aqui" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Itens</th>
                <th>Pagamento</th>
                <th>Status</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`${base}/${o.id}`} className="font-medium hover:underline">
                      #{o.number}
                    </Link>
                    <p className="text-xs text-zinc-400">{dateTime(o.createdAt)}</p>
                  </td>
                  <td>{customerName[o.customerId]}</td>
                  <td className="text-zinc-500">
                    <span className="flex items-center gap-1">
                      {o.items.slice(0, 3).map((i) => (
                        <Thumb key={`${i.productId}:${i.variantId}`} url={i.imageUrl} emoji={i.image} alt={i.name} className="size-7 rounded-md" emojiClassName="text-sm" />
                      ))}
                      <span className="text-xs">({o.items.reduce((s, i) => s + i.qty, 0)})</span>
                      {o.couponCode && <span className="ml-1 rounded bg-emerald-50 px-1 font-mono text-[10px] text-emerald-700">{o.couponCode}</span>}
                    </span>
                  </td>
                  <td className="text-zinc-500">{paymentLabel[o.paymentMethod]}</td>
                  <td>
                    {o.status === "pending" && paymentByOrder[o.id] ? <PaymentStatusBadge status={paymentByOrder[o.id].status} /> : <OrderStatusBadge status={o.status} />}
                  </td>
                  <td className="text-right font-medium">{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
