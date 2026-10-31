import Link from "next/link";
import { Plus } from "lucide-react";
import { CouponManager } from "@/components/painel/coupon-manager";
import { EndPromoButton } from "@/components/painel/end-promo-button";
import { Thumb } from "@/components/media";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { loadStore } from "@/lib/data/load-store";
import { couponStatus, listCoupons, listOrders, listProducts } from "@/lib/data/repository";
import { dateTime, money } from "@/lib/format";
import { priceOf } from "@/lib/pricing";

export const metadata = { title: "Promoções" };

const DAY = 86_400_000;

export default async function PromotionsPage({ params }: { params: Promise<{ loja: string }> }) {
  const { loja } = await params;
  const store = await loadStore(loja);
  const now = Date.now();
  const [products, coupons, orders] = await Promise.all([listProducts(store.id, { includeInactive: true }), listCoupons(store.id), listOrders({ storeId: store.id })]);

  const promos = products
    .filter((p) => p.promo)
    .map((p) => {
      const info = priceOf(p, null, now);
      const scheduled = !!p.promo!.startsAt && new Date(p.promo!.startsAt).getTime() > now;
      const ended = !info.onSale && !scheduled;
      const endingSoon = info.onSale && !!p.promo!.endsAt && new Date(p.promo!.endsAt).getTime() - now < 3 * DAY;
      return { p, info, scheduled, ended, endingSoon };
    })
    .sort((a, b) => Number(b.info.onSale) - Number(a.info.onSale) || Number(b.scheduled) - Number(a.scheduled));
  const withCoupon = orders.filter((o) => o.couponCode && o.status !== "cancelled");
  const couponDiscount = withCoupon.reduce((s, o) => s + o.discount, 0);

  return (
    <>
      <PageHeader title="Promoções" description="Preços promocionais por produto e cupons de desconto." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Produtos em promoção" value={String(promos.filter((x) => x.info.onSale).length)} hint={`${promos.filter((x) => x.scheduled).length} agendada(s)`} />
        <StatCard label="Cupons ativos" value={String(coupons.filter((c) => couponStatus(c, now) === "active").length)} hint={`${coupons.length} no total`} />
        <StatCard label="Vendas com cupom" value={String(withCoupon.length)} hint={`${money(couponDiscount)} em descontos`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Produtos em promoção"
            description="Defina o preço promocional e o período no cadastro do produto"
            action={
              <ButtonLink href={`/${loja}/painel/produtos`} variant="outline" className="px-3 py-1.5 text-xs">
                <Plus className="size-3.5" /> Colocar produto em promoção
              </ButtonLink>
            }
          />
          {promos.length === 0 ? (
            <EmptyState title="Nenhum produto em promoção" />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {promos.map(({ p, info, scheduled, ended, endingSoon }) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <Thumb url={p.images[0]} emoji={p.image} alt={p.name} className="size-10 rounded-lg" emojiClassName="text-lg" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/${loja}/painel/produtos/${p.id}`} className="block truncate text-sm font-medium hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      <span className="font-medium text-red-600">{money(p.promo!.price)}</span> <span className="line-through">{money(p.price)}</span>
                      {p.promo!.endsAt ? ` · até ${dateTime(p.promo!.endsAt)}` : " · sem prazo"}
                      {scheduled && ` · começa ${dateTime(p.promo!.startsAt!)}`}
                    </p>
                  </div>
                  {info.onSale && <Badge tone={endingSoon ? "yellow" : "red"}>{endingSoon ? "Termina em breve" : `-${info.discountPct}%`}</Badge>}
                  {scheduled && <Badge tone="blue">Agendada</Badge>}
                  {ended && <Badge>Encerrada</Badge>}
                  {!ended && <EndPromoButton slug={loja} productId={p.id} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <CouponManager slug={loja} coupons={coupons.map((c) => ({ ...c, status: couponStatus(c, now) }))} />
      </div>
    </>
  );
}
