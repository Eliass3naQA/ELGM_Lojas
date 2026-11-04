import Link from "next/link";
import { moneyShort } from "@/lib/format";
import { displayViews, hasCutouts, hasShowroom } from "@/lib/showcase";
import { availableStock, fromPrice } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { Img } from "../media";
import { cn } from "../ui";
import { AddToCartButton } from "./add-to-cart";
import { FavoriteButton } from "./favorites";

/** Estoque total vendável (Infinity se não controla). */
export function totalAvailable(product: Product) {
  if (!product.trackStock) return Infinity;
  return product.variants.length ? product.variants.reduce((s, v) => s + v.stock, 0) : product.stock;
}

/** Carros com recorte pousam sobre o cenário e giram ao passar o mouse; os demais usam a foto. */
function CardMedia({ product, wide }: { product: Product; wide: boolean }) {
  if (hasCutouts(product) && product.showcase) {
    const views = displayViews(product.showcase).map((v) => product.showcase!.views[v]!);
    // sozinho na coleção, o card vem logo abaixo da abertura: mostra outro ângulo para não repetir a mesma foto
    const [main, alt] = wide && views.length > 1 ? [views[1], views[0]] : views;
    return (
      <>
        <Img src={main} alt={product.name} className="shop-cutout p-[5%]" />
        {alt && <Img src={alt} alt="" className="shop-cutout shop-cutout-alt p-[5%]" />}
      </>
    );
  }
  const [first, second] = product.images;
  if (!first) return <span className="absolute inset-0 grid place-items-center text-7xl transition duration-500 group-hover:scale-105">{product.image}</span>;
  return (
    <>
      <Img src={first} alt={product.name} className="absolute inset-0 size-full object-cover transition duration-1000 group-hover:scale-[1.03]" />
      {second && <Img src={second} alt="" className="absolute inset-0 size-full object-cover opacity-0 transition duration-700 group-hover:opacity-100" />}
    </>
  );
}

export function ProductCard({ product, slug, now, vehicle = false, wide = false }: { product: Product; slug: string; now: number; vehicle?: boolean; wide?: boolean }) {
  const price = fromPrice(product, now);
  const available = totalAvailable(product);
  const href = `/${slug}/produto/${product.id}`;
  const varies = product.variants.some((v) => v.price !== null);
  const soldOut = available === 0;
  return (
    <article className="group reveal relative flex flex-col">
      <div className="relative">
        <Link href={href} tabIndex={-1} aria-hidden className={cn("shop-media", wide ? "aspect-[4/3] md:aspect-[21/9]" : "aspect-[4/3]")}>
          <CardMedia product={product} wide={wide} />
          {soldOut && <span className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-medium tracking-wide text-white backdrop-blur-[2px]">{vehicle ? "Vendido" : "Esgotado"}</span>}
        </Link>
        <div className="pointer-events-none absolute left-3.5 top-3.5 flex gap-1.5">
          {price.onSale && <span className="rounded-full bg-[var(--brand)] px-2.5 py-1 text-[11px] font-semibold text-white">-{price.discountPct}%</span>}
          {hasShowroom(product) && <span className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white/85 backdrop-blur">360°</span>}
        </div>
        <FavoriteButton slug={slug} productId={product.id} name={product.name} className="pdp-icon-btn shop-fav absolute right-3 top-3 size-10" iconClassName="size-4" />
      </div>

      <div className="flex flex-1 flex-col px-1 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href={href} className="line-clamp-2 text-[15px] font-medium leading-snug tracking-[-0.01em] text-white after:absolute after:inset-x-0 after:top-0 after:bottom-[-4px] group-hover:text-[var(--amber)]">
              {product.name}
            </Link>
            <p className="pdp-muted mt-1 text-[13px]">{product.category}</p>
          </div>
          <div className="shrink-0 text-right tabular-nums">
            {varies && <p className="pdp-muted text-[11px]">a partir de</p>}
            <p className="text-[15px] font-medium text-white">{moneyShort(price.price)}</p>
            {price.onSale && <p className="pdp-muted text-xs line-through">{moneyShort(price.regular)}</p>}
          </div>
        </div>
        {!vehicle && available > 0 && available <= product.lowStockThreshold && <p className="mt-1.5 text-xs text-[var(--amber)]">{available === 1 ? "Última unidade" : `Últimas ${available} unidades`}</p>}
        {!vehicle && !product.variants.length && !soldOut && (
          <div className="relative z-10 mt-3">
            <AddToCartButton
              item={{ productId: product.id, variantId: null, variantLabel: null, name: product.name, image: product.image, imageUrl: product.images[0] ?? null, price: price.price, stock: availableStock(product) }}
              compact
            />
          </div>
        )}
      </div>
    </article>
  );
}
