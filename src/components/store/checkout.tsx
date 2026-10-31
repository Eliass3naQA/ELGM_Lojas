"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Barcode, CreditCard, Loader2, LogIn, MapPin, Minus, Plus, QrCode, Ticket, Trash2, UserRoundPen, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { money } from "@/lib/format";
import type { Order, PaymentMethod } from "@/lib/types";
import { itemKey, useCart } from "../cart";
import { Thumb } from "../media";
import { Button, ButtonLink, Card, EmptyState, Input, cn } from "../ui";

const methods: { id: PaymentMethod; label: string; icon: typeof QrCode; hint: string; disabled?: boolean }[] = [
  { id: "pix", label: "Pix", icon: QrCode, hint: "QR Code ou copia e cola" },
  { id: "boleto", label: "Boleto", icon: Barcode, hint: "Vence em 3 dias" },
  { id: "card", label: "Cartão", icon: CreditCard, hint: "Em breve", disabled: true },
];

export type CheckoutViewer =
  | { state: "anon" }
  | { state: "incomplete" }
  | { state: "ready"; name: string; email: string; address: string };

export function Checkout({ slug, shippingFlat, freeShippingOver, viewer }: { slug: string; shippingFlat: number; freeShippingOver: number | null; viewer: CheckoutViewer }) {
  const cart = useCart();
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [couponText, setCouponText] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number; shipping: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  async function applyCoupon(code: string) {
    setCouponBusy(true);
    setCouponMsg(null);
    try {
      setCoupon(await api(`/api/stores/${slug}/coupons/check`, "POST", { code, subtotal: cart.subtotal }));
    } catch (e) {
      setCoupon(null);
      setCouponMsg((e as Error).message);
    } finally {
      setCouponBusy(false);
    }
  }

  // carrinho mudou: o desconto (e o pedido mínimo do cupom) precisa ser recalculado
  const appliedCode = coupon?.code;
  useEffect(() => {
    if (appliedCode) applyCoupon(appliedCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.subtotal]);

  if (!cart.ready) return null;
  if (cart.items.length === 0)
    return (
      <Card>
        <EmptyState title="Seu carrinho está vazio" description="Que tal dar uma olhada nos nossos produtos?" action={<ButtonLink href={`/${slug}/home`} variant="brand">Ver produtos</ButtonLink>} />
      </Card>
    );

  const baseShipping = freeShippingOver !== null && cart.subtotal >= freeShippingOver ? 0 : shippingFlat;
  const shipping = coupon ? coupon.shipping : baseShipping;
  const freeShipping = shipping === 0;
  const discount = coupon?.discount ?? 0;
  const missing = freeShippingOver !== null ? freeShippingOver - cart.subtotal : 0;

  const cartUrl = encodeURIComponent(`/${slug}/carrinho`);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (viewer.state !== "ready") return;
    setLoading(true);
    setError(null);
    try {
      const order = await api<Order>(`/api/stores/${slug}/orders`, "POST", {
        items: cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })),
        paymentMethod: payment,
        couponCode: coupon?.code ?? null,
      });
      cart.clear();
      router.push(`/${slug}/pedido/${order.id}?novo=1`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card>
          <ul className="divide-y divide-zinc-100">
            {cart.items.map((it) => (
              <li key={itemKey(it)} className="flex items-center gap-4 p-4">
                <Thumb url={it.imageUrl} emoji={it.image} alt={it.name} className="size-16 rounded-xl" emojiClassName="text-3xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.name}</p>
                  {it.variantLabel && <p className="text-xs text-zinc-500">{it.variantLabel}</p>}
                  <p className="text-sm text-zinc-500">{money(it.price)}</p>
                </div>
                <div className="flex items-center rounded-lg border border-zinc-200">
                  <button type="button" className="p-1.5 text-zinc-500" onClick={() => cart.setQty(itemKey(it), it.qty - 1)} aria-label="Diminuir">
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-7 text-center text-sm">{it.qty}</span>
                  <button type="button" className="p-1.5 text-zinc-500" onClick={() => cart.setQty(itemKey(it), it.qty + 1)} aria-label="Aumentar">
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <p className="w-24 text-right text-sm font-medium">{money(it.price * it.qty)}</p>
                <button type="button" className="text-zinc-400 hover:text-red-600" onClick={() => cart.remove(itemKey(it))} aria-label="Remover">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Entrega</h2>
          {viewer.state === "anon" && (
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-zinc-50 p-4">
              <LogIn className="size-5 text-zinc-400" />
              <p className="flex-1 text-sm text-zinc-600">Entre com Google, Microsoft ou Apple para finalizar a compra.</p>
              <ButtonLink href={`/${slug}/entrar?next=${cartUrl}`} variant="brand">
                Entrar
              </ButtonLink>
            </div>
          )}
          {viewer.state === "incomplete" && (
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-amber-50 p-4">
              <UserRoundPen className="size-5 text-amber-600" />
              <p className="flex-1 text-sm text-amber-800">Complete seu cadastro (CPF e endereço) e aceite os termos para continuar.</p>
              <ButtonLink href={`/${slug}/cadastro?next=${cartUrl}`} variant="brand">
                Completar cadastro
              </ButtonLink>
            </div>
          )}
          {viewer.state === "ready" && (
            <div className="mt-4 flex items-start gap-3 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-zinc-400" />
              <div className="flex-1">
                <p className="font-medium">
                  {viewer.name} <span className="font-normal text-zinc-500">· {viewer.email}</span>
                </p>
                <p className="mt-0.5 text-zinc-600">{viewer.address}</p>
              </div>
              <Link href={`/${slug}/cadastro?next=${cartUrl}`} className="text-xs font-medium text-zinc-500 underline hover:text-zinc-900">
                Alterar
              </Link>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Pagamento</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {methods.map(({ id, label, icon: Icon, hint, disabled }) => (
              <button
                type="button"
                key={id}
                disabled={disabled}
                onClick={() => setPayment(id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
                  payment === id ? "ring-brand border-transparent ring-2" : "border-zinc-200 hover:border-zinc-300",
                )}
              >
                <Icon className="size-5 text-zinc-700" />
                <p className="mt-2 text-sm font-medium">{label}</p>
                <p className="text-xs text-zinc-500">{hint}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <aside>
        <Card className="sticky top-24 p-5">
          <h2 className="font-semibold">Resumo</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Subtotal ({cart.count} itens)</dt>
              <dd>{money(cart.subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <dt>Cupom {coupon?.code}</dt>
                <dd>− {money(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-zinc-500">Frete</dt>
              <dd>{freeShipping ? <span className="font-medium text-emerald-600">Grátis</span> : money(shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-zinc-100 pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd>{money(cart.subtotal - discount + shipping)}</dd>
            </div>
          </dl>
          <div className="mt-4">
            {coupon ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <Ticket className="size-4" /> <b className="font-mono">{coupon.code}</b> aplicado
                <button
                  type="button"
                  onClick={() => {
                    setCoupon(null);
                    setCouponText("");
                  }}
                  className="ml-auto text-emerald-700 hover:text-emerald-900"
                  aria-label="Remover cupom"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={couponText}
                  onChange={(e) => setCouponText(e.target.value.toUpperCase())}
                  // Enter aqui aplica o cupom em vez de enviar o pedido
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (couponText.trim()) applyCoupon(couponText);
                    }
                  }}
                  placeholder="Cupom de desconto"
                  className="font-mono text-xs uppercase"
                />
                <Button type="button" variant="outline" disabled={!couponText.trim() || couponBusy} onClick={() => applyCoupon(couponText)}>
                  {couponBusy ? <Loader2 className="size-4 animate-spin" /> : "Aplicar"}
                </Button>
              </div>
            )}
            {couponMsg && <p className="mt-1.5 text-xs text-red-600">{couponMsg}</p>}
          </div>
          {baseShipping > 0 && !freeShipping && missing > 0 && (
            <div className="mt-4">
              <p className="text-xs text-zinc-500">
                Faltam <b className="text-zinc-900">{money(missing)}</b> para frete grátis
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.min(100, (cart.subtotal / freeShippingOver!) * 100)}%` }} />
              </div>
            </div>
          )}
          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button variant="brand" type="submit" disabled={loading || viewer.state !== "ready"} className="mt-5 w-full py-3">
            {loading && <Loader2 className="size-4 animate-spin" />} Finalizar compra
          </Button>
          {viewer.state === "ready" && <p className="mt-2 text-center text-xs text-zinc-400">Na próxima tela você verá os dados para pagamento.</p>}
          <Link href={`/${slug}/home`} className="mt-3 block text-center text-xs text-zinc-500 hover:text-zinc-900">
            Continuar comprando
          </Link>
        </Card>
      </aside>
    </form>
  );
}
