"use client";

import { useMemo, useState } from "react";
import { Clock, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { dateTime } from "@/lib/format";
import { availableStock, priceOf, variantLabel } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { Img } from "../media";
import { cn } from "../ui";
import { AddToCartButton } from "./add-to-cart";
import { Price } from "./product-card";

// Valores de opção que viram amostras de cor (como no configurador), em vez de botões de texto.
const swatch: Record<string, string> = {
  preto: "#18181b", branco: "#fafafa", cinza: "#9ca3af", grafite: "#3f3f46", prata: "#d4d4d8", azul: "#2563eb", marinho: "#1e3a8a",
  verde: "#16a34a", oliva: "#65743a", vermelho: "#dc2626", vinho: "#7f1d1d", rosa: "#f472b6", amarelo: "#facc15", laranja: "#f97316",
  roxo: "#7c3aed", lilás: "#c4b5fd", bege: "#e7d8c3", marrom: "#7c4a2d", caramelo: "#b4723a", nude: "#e5c2a8", dourado: "#d4a72c", off: "#f5f1e8",
};
const swatchOf = (value: string) => swatch[value.toLowerCase().split(/[\s-]/)[0]!];

type Tab = "opcoes" | "detalhes" | "entrega";

export function ProductConfigurator({ product, now, shippingText }: { product: Product; now: number; shippingText: string }) {
  // pré-seleciona a primeira combinação disponível
  const firstAvailable = product.variants.find((v) => !product.trackStock || v.stock > 0) ?? product.variants[0];
  const [choice, setChoice] = useState<Record<string, string>>(firstAvailable?.options ?? {});
  const [tab, setTab] = useState<Tab>(product.options.length ? "opcoes" : "detalhes");
  const [photo, setPhoto] = useState(0);
  const variant = useMemo(() => product.variants.find((v) => product.options.every((o) => v.options[o.name] === choice[o.name])) ?? null, [product, choice]);
  const price = priceOf(product, variant, now);
  const stock = availableStock(product, product.variants.length ? variant : null);
  const missing = product.options.find((o) => !choice[o.name]);

  // um valor está disponível se existe combinação com ele + as outras escolhas atuais, com estoque
  const isAvailable = (optName: string, value: string) =>
    product.variants.some((v) => v.options[optName] === value && product.options.every((o) => o.name === optName || !choice[o.name] || v.options[o.name] === choice[o.name]) && (!product.trackStock || v.stock > 0));

  const tabs: { id: Tab; label: string }[] = [
    ...(product.options.length ? [{ id: "opcoes" as const, label: "Opções" }] : []),
    { id: "detalhes", label: "Detalhes" },
    { id: "entrega", label: "Entrega" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      {/* coluna de opções */}
      <div className="glass order-2 flex flex-col rounded-[28px] p-5 lg:order-1">
        <div className="flex gap-1 rounded-full bg-zinc-900/[0.05] p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn("flex-1 rounded-full px-3 py-2 text-sm font-medium transition", tab === t.id ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex-1">
          {tab === "opcoes" &&
            product.options.map((o) => {
              const colors = o.values.every((v) => swatchOf(v));
              return (
                <div key={o.name} className="mb-6 last:mb-0">
                  <p className="text-sm font-semibold text-zinc-900">
                    {o.name} <span className="ml-1 font-normal text-zinc-500">{choice[o.name] ?? "escolha"}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {o.values.map((value) => {
                      const available = isAvailable(o.name, value);
                      const selected = choice[o.name] === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setChoice((c) => ({ ...c, [o.name]: value }))}
                          title={available ? value : `${value} — indisponível nesta combinação`}
                          aria-pressed={selected}
                          className={cn(
                            "relative grid place-items-center rounded-2xl text-sm font-medium transition",
                            colors ? "size-14" : "h-12 min-w-14 px-4",
                            selected ? "bg-white text-zinc-950 shadow-[0_10px_24px_-12px_rgb(0_0_0/0.45)] ring-2 ring-zinc-950" : "bg-white/50 text-zinc-700 ring-1 ring-white hover:bg-white/80",
                            !available && !selected && "opacity-40",
                          )}
                        >
                          {colors ? (
                            <span className="size-8 rounded-full shadow-[inset_0_-4px_8px_rgb(0_0_0/0.18),inset_0_2px_4px_rgb(255_255_255/0.5)] ring-1 ring-black/10" style={{ background: swatchOf(value) }} />
                          ) : (
                            value
                          )}
                          {!available && <span className="absolute inset-x-2 top-1/2 h-px -rotate-12 bg-zinc-500" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          {tab === "detalhes" && (
            <div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600">{product.description || "Sem descrição."}</p>
              {(variant?.sku || product.sku) && <p className="mt-4 font-mono text-xs text-zinc-400">SKU {variant?.sku || product.sku}</p>}
            </div>
          )}

          {tab === "entrega" && (
            <ul className="space-y-2.5 text-sm text-zinc-700">
              {[
                { icon: Truck, text: shippingText },
                { icon: RotateCcw, text: "Troca grátis em até 30 dias" },
                { icon: ShieldCheck, text: "Compra 100% segura" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 rounded-2xl bg-white/50 px-3 py-3">
                  <span className="grid size-8 place-items-center rounded-full bg-white shadow-sm">
                    <Icon className="size-4 text-zinc-600" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          )}
        </div>

        {Number.isFinite(stock) && stock > 0 && stock <= product.lowStockThreshold && (
          <p className="mt-5 rounded-2xl bg-amber-500/12 px-3 py-2 text-sm font-medium text-amber-700">
            Restam apenas {stock} unidades{variant ? ` em ${variantLabel(variant)}` : ""}!
          </p>
        )}
        {variant && stock === 0 && <p className="mt-5 text-sm text-zinc-500">{variantLabel(variant)} está esgotado. Escolha outra opção.</p>}
        {tab !== "entrega" && (
          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <Truck className="size-3.5" /> {shippingText}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RotateCcw className="size-3.5" /> Troca em 30 dias
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> Compra segura
            </span>
          </div>
        )}
      </div>

      {/* palco do produto + preço */}
      <div className="glass relative order-1 flex flex-col overflow-hidden rounded-[28px] p-4 sm:p-6 lg:order-2">
        <div className="stage-floor pointer-events-none absolute inset-x-0 bottom-0 h-1/2" />
        {price.onSale && (
          <span className="relative z-10 inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-semibold text-white shadow-[0_6px_14px_-6px_var(--brand)]">
            -{price.discountPct}%{price.endsAt && <><Clock className="ml-1 size-3.5" /> até {dateTime(price.endsAt)}</>}
          </span>
        )}
        <div className="relative grid min-h-[300px] flex-1 place-items-center py-4 sm:min-h-[420px]">
          {product.images.length ? (
            <Img
              key={photo}
              src={product.images[photo]}
              alt={product.name}
              loading="eager"
              className="reflect animate-fade-up max-h-[440px] w-auto max-w-full rounded-3xl object-contain drop-shadow-[0_30px_30px_rgba(0,0,0,.18)]"
            />
          ) : (
            <span className="reflect select-none text-[10rem] leading-none drop-shadow-[0_24px_24px_rgba(0,0,0,.18)] sm:text-[14rem]">{product.image}</span>
          )}
        </div>

        <div className="relative mt-2 flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
            {product.images.length > 1 &&
              product.images.map((url, i) => (
                <button
                  key={url}
                  onClick={() => setPhoto(i)}
                  aria-label={`Foto ${i + 1}`}
                  className={cn("shrink-0 rounded-2xl p-1 transition", i === photo ? "bg-white shadow-[0_8px_20px_-10px_rgb(0_0_0/0.35)]" : "bg-white/40 opacity-80 hover:opacity-100")}
                >
                  <Img src={url} alt="" className="size-14 rounded-xl object-cover sm:size-16" />
                </button>
              ))}
          </div>
          <div className="glass-strong rounded-[24px] p-3 xl:w-[400px]">
            <div className="flex items-end justify-between gap-3 px-2 pb-3 pt-1">
              <div>
                <p className="text-[11px] text-zinc-500">Preço</p>
                <Price price={price} large />
              </div>
              <p className="pb-1 text-right text-xs text-zinc-500">
                ou 3x de {(price.price / 3).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                <br />
                sem juros
              </p>
            </div>
            <AddToCartButton
              key={variant?.id ?? "base"}
              item={{
                productId: product.id,
                variantId: variant?.id ?? null,
                variantLabel: variant ? variantLabel(variant) : null,
                name: product.name,
                image: product.image,
                imageUrl: product.images[0] ?? null,
                price: price.price,
                stock: product.variants.length && !variant ? 0 : stock,
              }}
              disabled={missing ? `Escolha ${missing.name.toLowerCase()}` : product.variants.length > 0 && !variant ? "Combinação indisponível" : false}
              withQty
            />
          </div>
        </div>
      </div>
    </div>
  );
}
