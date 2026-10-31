// Regras de preço e estoque usadas tanto no servidor (checkout) quanto na vitrine.
import type { Product, Promo, Variant } from "./types";

export function promoActive(promo: Promo | null, now = Date.now()): promo is Promo {
  if (!promo) return false;
  if (promo.startsAt && new Date(promo.startsAt).getTime() > now) return false;
  if (promo.endsAt && new Date(promo.endsAt).getTime() <= now) return false;
  return true;
}

export interface PriceInfo {
  price: number; // o que o cliente paga
  regular: number; // preço cheio
  onSale: boolean;
  discountPct: number;
  endsAt: string | null;
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Preço efetivo. Variação com preço próprio recebe o mesmo % de desconto da promoção. */
export function priceOf(product: Pick<Product, "price" | "promo">, variant?: Pick<Variant, "price"> | null, now = Date.now()): PriceInfo {
  const regular = variant?.price ?? product.price;
  if (!promoActive(product.promo, now) || product.promo.price >= product.price) {
    return { price: regular, regular, onSale: false, discountPct: 0, endsAt: null };
  }
  const ratio = product.promo.price / product.price;
  const price = variant?.price != null ? round(regular * ratio) : product.promo.price;
  return { price, regular, onSale: true, discountPct: Math.round((1 - ratio) * 100), endsAt: product.promo.endsAt };
}

/** Menor preço entre as variações (para "a partir de"). */
export function fromPrice(product: Product, now = Date.now()) {
  if (!product.variants.length) return priceOf(product, null, now);
  return product.variants.map((v) => priceOf(product, v, now)).sort((a, b) => a.price - b.price)[0];
}

export const variantLabel = (v: Pick<Variant, "options">) => Object.values(v.options).join(" / ");

/** Estoque vendável (Infinity quando o produto não controla estoque). */
export function availableStock(product: Pick<Product, "trackStock" | "stock">, variant?: Pick<Variant, "stock"> | null) {
  if (!product.trackStock) return Infinity;
  return variant ? variant.stock : product.stock;
}

export type StockLevel = "out" | "low" | "ok" | "untracked";

export function stockLevel(stock: number, threshold: number, tracked = true): StockLevel {
  if (!tracked) return "untracked";
  if (stock <= 0) return "out";
  if (stock <= threshold) return "low";
  return "ok";
}

/** Gera todas as combinações das opções (produto cartesiano). */
export function combinations(options: { name: string; values: string[] }[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, opt) => acc.flatMap((combo) => opt.values.map((v) => ({ ...combo, [opt.name]: v }))),
    [{}],
  );
}
