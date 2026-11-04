"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator, Calendar, ChevronRight, CircleGauge, ClipboardCheck, Clock, Cog, Disc3, DoorOpen, Fuel, Gauge, type LucideIcon, Luggage, MessageCircle, Palette, RotateCcw, Settings2, ShieldCheck, Tag, Truck, Users, Wrench, Zap,
} from "lucide-react";
import { dateTime, moneyShort } from "@/lib/format";
import { availableStock, priceOf, variantLabel } from "@/lib/pricing";
import { productFacts, specKind, type SpecKind } from "@/lib/product-facts";
import type { Product, Spec } from "@/lib/types";
import { useCart } from "../cart";
import { cn } from "../ui";
import { AddToCartButton } from "./add-to-cart";
import { FavoriteButton } from "./favorites";
import { FinanceSimulator } from "./finance-simulator";
import { ProductGallery } from "./product-gallery";

const SPEC_ICON: Record<SpecKind, LucideIcon> = {
  km: Gauge, fuel: Fuel, gearbox: Settings2, engine: Cog, power: Zap, torque: CircleGauge, drive: Disc3, doors: DoorOpen, seats: Users, trunk: Luggage,
  year: Calendar, color: Palette, warranty: ShieldCheck, service: Wrench, origin: ClipboardCheck, report: ClipboardCheck, other: Tag,
};
const SpecIcon = ({ label, className }: { label: string; className?: string }) => {
  const Icon = SPEC_ICON[specKind(label)];
  return <Icon className={className} />;
};

// Valores de opção que viram amostras de cor, em vez de botões de texto.
const swatch: Record<string, string> = {
  preto: "#18181b", branco: "#fafafa", cinza: "#9ca3af", grafite: "#3f3f46", prata: "#d4d4d8", azul: "#2563eb", marinho: "#1e3a8a",
  verde: "#16a34a", oliva: "#65743a", vermelho: "#dc2626", vinho: "#7f1d1d", rosa: "#f472b6", amarelo: "#facc15", laranja: "#f97316",
  roxo: "#7c3aed", lilás: "#c4b5fd", bege: "#e7d8c3", marrom: "#7c4a2d", caramelo: "#b4723a", nude: "#e5c2a8", dourado: "#d4a72c", off: "#f5f1e8",
};
const swatchOf = (value: string) => swatch[value.toLowerCase().split(/[\s-]/)[0]!];

type Tab = "detalhes" | "itens" | "descricao" | "entrega";

export function ProductView({
  product,
  slug,
  now,
  vehicle,
  whatsapp,
  brand,
  logoUrl,
  shippingText,
}: {
  product: Product;
  slug: string;
  now: number;
  vehicle: boolean;
  whatsapp: string | null;
  brand: string;
  logoUrl: string | null;
  shippingText: string;
}) {
  const router = useRouter();
  const { add } = useCart();
  const facts = useMemo(() => productFacts(product, vehicle), [product, vehicle]);

  // pré-seleciona a primeira combinação disponível
  const firstAvailable = product.variants.find((v) => !product.trackStock || v.stock > 0) ?? product.variants[0];
  const [choice, setChoice] = useState<Record<string, string>>(firstAvailable?.options ?? {});
  const variant = useMemo(() => product.variants.find((v) => product.options.every((o) => v.options[o.name] === choice[o.name])) ?? null, [product, choice]);
  const price = priceOf(product, variant, now);
  const stock = availableStock(product, product.variants.length ? variant : null);
  const missing = product.options.find((o) => !choice[o.name]);
  const blocked = missing ? `Escolha ${missing.name.toLowerCase()}` : product.variants.length > 0 && !variant ? "Combinação indisponível" : false;
  const soldOut = !blocked && stock <= 0;
  const canBuy = !blocked && !soldOut;

  const isAvailable = (optName: string, value: string) =>
    product.variants.some((v) => v.options[optName] === value && product.options.every((o) => o.name === optName || !choice[o.name] || v.options[o.name] === choice[o.name]) && (!product.trackStock || v.stock > 0));

  const tabs: { id: Tab; label: string }[] = [
    ...(facts.details.length || variant?.sku || product.sku ? [{ id: "detalhes" as const, label: "Detalhes" }] : []),
    ...(facts.equipment.length ? [{ id: "itens" as const, label: "Itens de série" }] : []),
    ...(facts.text ? [{ id: "descricao" as const, label: "Descrição" }] : []),
    ...(vehicle ? [] : [{ id: "entrega" as const, label: "Entrega" }]),
  ];
  const [tab, setTab] = useState<Tab | null>(tabs[0]?.id ?? null);

  const [simulating, setSimulating] = useState(false);

  // barra fixa no celular: aparece quando os botões principais saem da tela
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsVisible, setActionsVisible] = useState(true);
  useEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActionsVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cartItem = {
    productId: product.id,
    variantId: variant?.id ?? null,
    variantLabel: variant ? variantLabel(variant) : null,
    name: product.name,
    image: product.image,
    imageUrl: product.images[0] ?? null,
    price: price.price,
    stock: product.variants.length && !variant ? 0 : stock,
  };
  const buyNow = () => {
    add(cartItem, 1);
    router.push(`/${slug}/carrinho`);
  };
  const interest = `Olá! Tenho interesse no ${product.name}${variant ? ` (${variantLabel(variant)})` : ""}, anunciado por ${moneyShort(price.price)}.`;
  const whatsappUrl = whatsapp ? `https://wa.me/55${whatsapp}?text=${encodeURIComponent(interest)}` : null;

  // o principal de um veículo: falar com a loja; sem WhatsApp cadastrado, segue pela compra no site
  const wantIt = (className: string) => {
    if (!canBuy) {
      return (
        <button type="button" disabled className={cn(className, "pdp-btn-dark opacity-60")}>
          {blocked || (variant ? "Indisponível nesta opção" : "Veículo vendido")}
        </button>
      );
    }
    return whatsappUrl ? (
      <a href={whatsappUrl} target="_blank" rel="noreferrer" className={cn(className, "pdp-btn-dark")}>
        <MessageCircle className="size-[18px]" /> Quero este veículo
      </a>
    ) : (
      <button type="button" onClick={buyNow} className={cn(className, "pdp-btn-dark")}>
        Quero este veículo
      </button>
    );
  };

  const trust: { key: string; icon: LucideIcon; title: string; value?: string }[] = vehicle
    ? facts.trust.map((s: Spec) => ({ key: s.label, icon: SPEC_ICON[specKind(s.label)], title: s.label, value: s.value }))
    : [
        { key: "frete", icon: Truck, title: shippingText },
        { key: "troca", icon: RotateCcw, title: "Troca em 30 dias" },
        { key: "segura", icon: ShieldCheck, title: "Compra segura" },
      ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_clamp(380px,34vw,500px)] lg:items-start">
      <ProductGallery product={product} brand={brand} logoUrl={logoUrl} />

      <div className="pdp-panel relative rounded-[32px] p-5 sm:p-6">
        <FavoriteButton slug={slug} productId={product.id} name={product.name} className="pdp-icon-btn absolute right-4 top-4 size-11 sm:right-5 sm:top-5" iconClassName="size-[18px]" />
        <nav aria-label="Navegação" className="pdp-muted flex items-center gap-1.5 pr-14 text-[13px]">
          <Link href={`/${slug}/home`} className="hover:text-white">Início</Link>
          <ChevronRight className="size-3.5 shrink-0" />
          <Link href={`/${slug}/home?categoria=${encodeURIComponent(product.category)}`} className="truncate text-white/90 hover:text-white">{product.category}</Link>
        </nav>

        <h1 className="mt-3 text-[28px] font-normal leading-[1.12] tracking-[-0.025em] [text-wrap:balance] sm:text-[32px]">{facts.title}</h1>
        {facts.year && <p className="mt-1.5 text-lg text-white/85">{facts.year}</p>}

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[38px] font-semibold leading-none tracking-[-0.02em] tabular-nums sm:text-[42px]">{moneyShort(price.price)}</p>
            {price.onSale && (
              <span className="rounded-full bg-[var(--brand)] px-2.5 py-1 text-xs font-semibold text-white">-{price.discountPct}%</span>
            )}
          </div>
          {price.onSale && (
            <p className="pdp-muted mt-2 flex flex-wrap items-center gap-x-2 text-sm">
              <span className="line-through">{moneyShort(price.regular)}</span>
              {price.endsAt && (
                <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> até {dateTime(price.endsAt)}</span>
              )}
            </p>
          )}
          {!vehicle && <p className="pdp-muted mt-2 text-sm">ou 3x de {moneyShort(Math.round((price.price / 3) * 100) / 100)} sem juros</p>}
        </div>

        {facts.highlights.length > 0 && (
          <ul className="mt-5 grid auto-cols-fr grid-flow-col gap-2">
            {facts.highlights.map((s) => (
              <li key={s.label} className="pdp-chip min-w-0 rounded-2xl px-2.5 py-2.5 sm:px-3">
                <p className="pdp-muted flex items-center gap-1 text-[11px] xl:gap-1.5 xl:text-xs">
                  <SpecIcon label={s.label} className="size-3.5 shrink-0" /> <span className="truncate">{s.label}</span>
                </p>
                <p className="mt-0.5 text-sm font-medium leading-snug">{s.value.replace(/\s*\([^)]*\)\s*$/, "")}</p>
              </li>
            ))}
          </ul>
        )}

        {product.options.map((o) => {
          const colors = o.values.every((v) => swatchOf(v));
          return (
            <fieldset key={o.name} className="mt-5">
              <legend className="pdp-muted text-sm">
                {o.name}: <span className="font-medium text-white">{choice[o.name] ?? "escolha"}</span>
              </legend>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {o.values.map((value) => {
                  const available = isAvailable(o.name, value);
                  const selected = choice[o.name] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setChoice((c) => ({ ...c, [o.name]: value }))}
                      title={available ? value : `${value}: indisponível nesta combinação`}
                      aria-label={value}
                      aria-pressed={selected}
                      className={cn("relative", colors ? "pdp-swatch size-12" : "pdp-option h-11 min-w-12 px-4 text-sm", selected && (colors ? "pdp-swatch-active" : "pdp-option-active"), !available && !selected && "opacity-40")}
                    >
                      {colors ? <span className="block size-full rounded-full ring-1 ring-black/15" style={{ background: swatchOf(value) }} /> : value}
                      {!available && <span className="absolute inset-x-2 top-1/2 h-px -rotate-12 bg-current" />}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <div ref={actionsRef} className="mt-5">
          {vehicle ? (
            <>
              <div className="flex flex-wrap gap-2.5">
                {canBuy && (
                  <button type="button" onClick={() => setSimulating(true)} className="pdp-btn-light flex h-[52px] min-w-[198px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold">
                    <Calculator className="size-[18px]" /> Simular financiamento
                  </button>
                )}
                {wantIt("flex h-[52px] min-w-[172px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold")}
              </div>
              {whatsappUrl && canBuy && (
                <button type="button" onClick={buyNow} className="pdp-muted mt-3 w-full text-center text-sm underline-offset-4 hover:text-white hover:underline">
                  Prefere comprar pelo site? Colocar na sacola
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              <AddToCartButton key={variant?.id ?? "base"} item={cartItem} disabled={blocked} withQty className="min-w-[300px] flex-1 max-sm:min-w-full [&_button]:whitespace-nowrap" />
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="pdp-btn-dark flex h-12 min-w-[230px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold">
                  <MessageCircle className="size-[18px]" /> Tirar dúvidas no WhatsApp
                </a>
              )}
            </div>
          )}
        </div>

        {!vehicle && Number.isFinite(stock) && stock > 0 && stock <= product.lowStockThreshold && (
          <p className="mt-3 rounded-2xl bg-amber-400/15 px-3 py-2 text-sm font-medium text-amber-200">
            {stock === 1 ? "Resta apenas 1 unidade" : `Restam apenas ${stock} unidades`}{variant ? ` em ${variantLabel(variant)}` : ""}!
          </p>
        )}
        {!vehicle && variant && stock === 0 && <p className="pdp-muted mt-3 text-sm">{variantLabel(variant)} está esgotado. Escolha outra opção.</p>}

        {trust.length > 0 && (
          <ul className="pdp-chip mt-5 grid auto-cols-fr grid-flow-col divide-x divide-white/10 rounded-2xl py-3">
            {trust.map(({ key, icon: Icon, title, value }) => (
              <li key={key} className="flex min-w-0 items-center gap-2 px-3">
                <Icon className="size-5 shrink-0 text-white/80" />
                <div className="min-w-0 text-xs leading-snug">
                  <p className="font-medium">{title}</p>
                  {value && <p className="pdp-muted">{value}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}

        {tabs.length > 0 && tab && (
          <div className="mt-5">
            <div className="pdp-chip no-scrollbar flex gap-1 overflow-x-auto rounded-full p-1">
              {tabs.map((t) => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-pressed={tab === t.id} className={cn("flex-1 whitespace-nowrap rounded-full px-3.5 py-2.5 text-sm font-medium transition", tab === t.id ? "pdp-tab-active" : "text-white/75 hover:text-white")}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === "detalhes" && (
                <>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                    {facts.details.map((s) => (
                      <div key={s.label} className="flex min-w-0 gap-2.5">
                        <SpecIcon label={s.label} className="mt-0.5 size-[18px] shrink-0 text-white/70" />
                        <div className="min-w-0">
                          <dt className="pdp-muted text-xs">{s.label}</dt>
                          <dd className="text-sm font-medium leading-snug">{s.value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                  {(variant?.sku || product.sku) && <p className="pdp-muted mt-4 font-mono text-xs">SKU {variant?.sku || product.sku}</p>}
                </>
              )}
              {tab === "itens" && (
                <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-1">
                  {facts.equipment.map((item) => (
                    <li key={item} className="flex gap-2.5 leading-snug">
                      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-white/60" /> {item}
                    </li>
                  ))}
                </ul>
              )}
              {tab === "descricao" && <p className="whitespace-pre-line text-sm leading-relaxed text-white/85">{facts.text}</p>}
              {tab === "entrega" && (
                <ul className="space-y-2.5 text-sm">
                  <li className="flex items-center gap-2.5"><Truck className="size-[18px] text-white/70" /> {shippingText}</li>
                  <li className="flex items-center gap-2.5"><RotateCcw className="size-[18px] text-white/70" /> Troca grátis em até 30 dias</li>
                  <li className="flex items-center gap-2.5"><ShieldCheck className="size-[18px] text-white/70" /> Compra 100% segura</li>
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {vehicle && <FinanceSimulator open={simulating} onClose={() => setSimulating(false)} name={product.name} price={price.price} whatsapp={whatsapp} />}

      {/* celular: preço e ação principal sempre à mão */}
      <div className={cn("pdp-sticky fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 transition-transform duration-300 lg:hidden", actionsVisible && "translate-y-full")} aria-hidden={actionsVisible} inert={actionsVisible}>
        <div className="min-w-0 shrink-0">
          <p className="pdp-muted max-w-32 truncate text-xs">{facts.title}</p>
          <p className="text-lg font-semibold leading-tight tabular-nums">{moneyShort(price.price)}</p>
        </div>
        {vehicle ? wantIt("flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold") : <AddToCartButton key={variant?.id ?? "base"} item={cartItem} disabled={blocked} className="min-w-0 flex-1" />}
      </div>
    </div>
  );
}
