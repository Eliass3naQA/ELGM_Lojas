import { notFound, redirect } from "next/navigation";
import { loadStore } from "@/lib/data/load-store";
import { CheckCircle2, Copy, Package, Truck } from "lucide-react";
import { PaymentPanel } from "@/components/store/payment-panel";
import { Thumb } from "@/components/media";
import { ButtonLink, Card, OrderStatusBadge, cn } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/session";
import { getCustomerForUser, getOrder, getPayment } from "@/lib/data/repository";
import { providers } from "@/lib/payments/provider";
import { dateTime, money, paymentLabel } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

const steps: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: "Pedido recebido" },
  { status: "paid", label: "Pagamento aprovado" },
  { status: "shipped", label: "Enviado" },
  { status: "delivered", label: "Entregue" },
];

export default async function OrderPage({ params, searchParams }: { params: Promise<{ loja: string; id: string }>; searchParams: Promise<{ novo?: string }> }) {
  const { loja, id } = await params;
  const isNew = (await searchParams).novo === "1";
  const store = await loadStore(loja);
  const user = await getSessionUser();
  if (!user) redirect(`/${loja}/entrar?next=${encodeURIComponent(`/${loja}/pedido/${id}`)}`);
  const [order, customer] = await Promise.all([getOrder(store.id, id), getCustomerForUser(store.id, user)]);
  // só o próprio comprador vê o pedido
  if (!order || !customer || order.customerId !== customer.id) notFound();
  const payment = await getPayment(order.id);
  const needsPayment = payment && ["awaiting", "rejected"].includes(payment.status);
  const instructions = payment && needsPayment ? ((await providers[payment.provider]?.getInstructions(order, payment, store)) ?? null) : null;
  const current = order.status === "cancelled" ? -1 : steps.findIndex((s) => s.status === order.status);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {isNew && (
        <div className="mb-8 text-center animate-fade-up">
          <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Pedido confirmado!</h1>
          <p className="mt-1 text-zinc-500">Obrigado por comprar na {store.name}. Agora é só pagar e enviar o comprovante abaixo.</p>
        </div>
      )}

      {payment && (
        <div className="mb-6">
          <PaymentPanel slug={loja} orderId={order.id} payment={payment} instructions={instructions} />
        </div>
      )}

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">Pedido</p>
            <p className="text-xl font-semibold">#{order.number}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        {order.status !== "cancelled" && (
          <ol className="mt-8 grid grid-cols-4 gap-2">
            {steps.map((s, i) => (
              <li key={s.status} className="text-center">
                <div className={cn("mx-auto h-1.5 rounded-full", i <= current ? "bg-[var(--brand)]" : "bg-zinc-100")} />
                <p className={cn("mt-2 text-xs", i <= current ? "font-medium text-zinc-900" : "text-zinc-400")}>{s.label}</p>
              </li>
            ))}
          </ol>
        )}

        {order.trackingCode && (
          <div className="bg-brand-soft mt-6 flex items-center gap-3 rounded-xl p-4 text-sm">
            <Truck className="text-brand-strong size-5" />
            <div>
              <p className="font-medium">Código de rastreio</p>
              <p className="font-mono text-zinc-700">{order.trackingCode}</p>
            </div>
            <Copy className="ml-auto size-4 text-zinc-400" />
          </div>
        )}

        <ul className="mt-6 divide-y divide-zinc-100 border-t border-zinc-100">
          {order.items.map((it) => (
            <li key={`${it.productId}:${it.variantId}`} className="flex items-center gap-3 py-3 text-sm">
              <Thumb url={it.imageUrl} emoji={it.image} alt={it.name} className="size-10 rounded-lg" emojiClassName="text-xl" />
              <span className="flex-1">
                {it.qty}× {it.name}
                {it.variantLabel && <span className="block text-xs text-zinc-500">{it.variantLabel}</span>}
              </span>
              <span className="font-medium">{money(it.price * it.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t border-zinc-100 pt-4 text-sm">
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
            <dd>{order.shipping === 0 ? "Grátis" : money(order.shipping)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd>{money(order.total)}</dd>
          </div>
        </dl>
        <div className="mt-6 grid gap-4 rounded-xl bg-zinc-50 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Package className="size-3.5" /> Entrega
            </p>
            <p className="mt-1">{order.address}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Pagamento</p>
            <p className="mt-1">
              {paymentLabel[order.paymentMethod]} · {dateTime(order.createdAt)}
            </p>
          </div>
        </div>
      </Card>
      <div className="mt-6 flex justify-center gap-3">
        <ButtonLink href={`/${loja}/home`} variant="brand">
          Continuar comprando
        </ButtonLink>
        <ButtonLink href={`/${loja}/conta`} variant="outline">
          Meus pedidos
        </ButtonLink>
      </div>
    </main>
  );
}
