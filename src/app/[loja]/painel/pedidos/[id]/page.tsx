import Link from "next/link";
import { loadStore } from "@/lib/data/load-store";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { OrderActions } from "@/components/painel/order-actions";
import { PaymentReview } from "@/components/painel/payment-review";
import { Thumb } from "@/components/media";
import { Card, CardHeader, OrderStatusBadge } from "@/components/ui";
import { getCustomer, getOrder, getPayment } from "@/lib/data/repository";
import { authProviders } from "@/lib/auth/providers";
import { dateTime, money, paymentLabel } from "@/lib/format";

export default async function OrderDetail({ params }: { params: Promise<{ loja: string; id: string }> }) {
  const { loja, id } = await params;
  const store = await loadStore(loja);
  const order = await getOrder(store.id, id);
  if (!order) notFound();
  const [customer, payment] = await Promise.all([getCustomer(order.customerId), getPayment(order.id)]);

  return (
    <>
      <Link href={`/${loja}/painel/pedidos`} className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ChevronLeft className="size-4" /> Pedidos
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Pedido #{order.number}</h1>
        <OrderStatusBadge status={order.status} />
        <span className="text-sm text-zinc-500">{dateTime(order.createdAt)}</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Itens" />
            <ul className="divide-y divide-zinc-100">
              {order.items.map((it) => (
                <li key={`${it.productId}:${it.variantId}`} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <Thumb url={it.imageUrl} emoji={it.image} alt={it.name} className="size-11 rounded-xl" emojiClassName="text-2xl" />
                  <span className="flex-1">
                    {it.name}
                    {it.variantLabel && <span className="block text-xs text-zinc-500">{it.variantLabel}</span>}
                  </span>
                  <span className="text-zinc-500">
                    {it.qty} × {money(it.price)}
                  </span>
                  <span className="w-24 text-right font-medium">{money(it.qty * it.price)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-zinc-100 px-5 py-4 text-sm">
              <div className="flex justify-between text-zinc-500">
                <dt>Subtotal</dt>
                <dd>{money(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <dt>Cupom {order.couponCode}</dt>
                  <dd>− {money(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-zinc-500">
                <dt>Frete</dt>
                <dd>{order.shipping ? money(order.shipping) : "Grátis"}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Total</dt>
                <dd>{money(order.total)}</dd>
              </div>
            </dl>
          </Card>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="p-5 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Cliente</p>
              <Link href={`/${loja}/painel/clientes/${customer?.id}`} className="mt-2 block font-medium hover:underline">
                {customer?.name}
              </Link>
              <p className="text-zinc-500">{customer?.email}</p>
              <p className="text-zinc-500">{customer?.phone}</p>
              {customer?.cpf && <p className="text-zinc-500">CPF {customer.cpf}</p>}
              {customer?.provider && <p className="mt-1 text-xs text-zinc-400">Login via {authProviders[customer.provider].label}</p>}
            </Card>
            <Card className="p-5 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Entrega</p>
              <p className="mt-2">{order.address}</p>
              <p className="mt-2 text-zinc-500">Pagamento: {paymentLabel[order.paymentMethod]}</p>
              {order.trackingCode && <p className="mt-1 font-mono text-zinc-700">{order.trackingCode}</p>}
            </Card>
          </div>
        </div>
        <div className="space-y-6">
          {payment && <PaymentReview slug={loja} payment={payment} />}
          <OrderActions slug={loja} order={order} />
        </div>
      </div>
    </>
  );
}
