import Link from "next/link";
import { Rotate3d } from "lucide-react";
import { money } from "@/lib/format";
import { hasShowroom } from "@/lib/showcase";
import { availableStock, fromPrice, type PriceInfo } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { Img } from "../media";
import { AddToCartButton } from "./add-to-cart";

/** Estoque total vendável (Infinity se não controla). */
export function totalAvailable(product: Product) {
  if (!product.trackStock) return Infinity;
  return product.variants.length ? product.variants.reduce((s, v) => s + v.stock, 0) : product.stock;
}

export function ProductImage({ product, price, soldOut }: { product: Product; price: PriceInfo; soldOut: boolean }) {
  const [first, second] = product.images;
  return (
    <div className="relative grid aspect-square place-items-center overflow-hidden rounded-[20px] bg-white/70 ring-1 ring-white">
      {first ? (
        <>
          <Img src={first} alt={product.name} className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105" />
          {/* segunda foto aparece ao passar o mouse */}
          {second && <Img src={second} alt="" className="absolute inset-0 size-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" />}
        </>
      ) : (
        <span className="text-7xl transition duration-300 group-hover:scale-110">{product.image}</span>
      )}
      {hasShowroom(product) && (
        <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-zinc-950/80 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-lg backdrop-blur">
          <Rotate3d className="size-3.5" /> 360°
        </span>
      )}
      {price.onSale && <span className="absolute left-2.5 top-2.5 rounded-full bg-[var(--brand)] px-2.5 py-1 text-xs font-semibold text-white shadow-[0_6px_14px_-6px_var(--brand)]">-{price.discountPct}%</span>}
      {soldOut && (
        <span className="absolute inset-0 grid place-items-center bg-white/45 backdrop-blur-sm">
          <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-zinc-700 shadow-sm">Esgotado</span>
        </span>
      )}
    </div>
  );
}

export function Price({ price, large, from }: { price: PriceInfo; large?: boolean; from?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      {from && <span className="text-xs text-zinc-500">a partir de</span>}
      <span className={large ? "text-3xl font-semibold tracking-[-0.02em] tabular-nums" : "font-semibold tabular-nums text-zinc-950"}>{money(price.price)}</span>
      {price.onSale && <span className="text-sm text-zinc-400 line-through">{money(price.regular)}</span>}
    </div>
  );
}

export function ProductCard({ product, slug, now }: { product: Product; slug: string; now: number }) {
  const price = fromPrice(product, now);
  const available = totalAvailable(product);
  const href = `/${slug}/produto/${product.id}`;
  const varies = product.variants.some((v) => v.price !== null);
  return (
    <div className="glass group animate-fade-up flex flex-col rounded-[26px] p-2 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_30px_50px_-28px_rgb(0_0_0/0.35)]">
      <Link href={href}>
        <ProductImage product={product} price={price} soldOut={available === 0} />
      </Link>
      <div className="flex flex-1 flex-col px-2 pb-1.5 pt-3">
        <p className="text-xs text-zinc-500">{product.category}</p>
        <Link href={href} className="mt-0.5 line-clamp-2 text-sm font-medium text-zinc-900 hover:underline">
          {product.name}
        </Link>
        <div className="mt-1.5">
          <Price price={price} from={varies} />
        </div>
        {available > 0 && available <= product.lowStockThreshold && <p className="mt-1 text-xs font-medium text-amber-600">Últimas {available} unidades</p>}
        {/* empurra o botão para a base, alinhando cards de alturas diferentes */}
        <div className="min-h-3 flex-1" />
        {product.variants.length ? (
          <Link href={href} className="rounded-full bg-white/75 py-2 text-center text-xs font-medium text-zinc-800 shadow-sm transition hover:bg-white">
            {available === 0 ? "Esgotado" : `Ver ${product.options.map((o) => o.name.toLowerCase()).join(" e ")}`}
          </Link>
        ) : (
          <AddToCartButton
            item={{ productId: product.id, variantId: null, variantLabel: null, name: product.name, image: product.image, imageUrl: product.images[0] ?? null, price: price.price, stock: availableStock(product) }}
            compact
          />
        )}
      </div>
    </div>
  );
}
