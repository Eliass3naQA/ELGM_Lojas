import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { moneyShort } from "@/lib/format";
import { fromPrice } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { Thumb } from "../media";
import { FavoriteButton } from "./favorites";

export function SimilarProducts({ products, slug, now, title, allHref }: { products: Product[]; slug: string; now: number; title: string; allHref: string }) {
  if (!products.length) return null;
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-white">{title}</h2>
        <Link href={allHref} className="inline-flex items-center gap-1.5 text-sm text-white/85 hover:text-white">
          Ver todos <ArrowRight className="size-4" />
        </Link>
      </div>
      <ul className="no-scrollbar -mx-3 mt-3 flex snap-x gap-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 xl:grid xl:grid-cols-4">
        {products.map((p) => {
          const price = fromPrice(p, now);
          const href = `/${slug}/produto/${p.id}`;
          return (
            <li key={p.id} className="pdp-card group relative flex w-[290px] shrink-0 snap-start items-center gap-3 rounded-[22px] p-2.5 xl:w-auto">
              <Thumb url={p.images[0]} emoji={p.image} alt="" className="size-20 rounded-2xl" emojiClassName="text-4xl" />
              <div className="min-w-0 flex-1">
                <Link href={href} className="line-clamp-2 text-sm font-medium leading-snug text-white after:absolute after:inset-0 after:rounded-[22px] group-hover:underline">
                  {p.name}
                </Link>
                <p className="mt-1 text-sm font-semibold tabular-nums text-white">
                  {p.variants.some((v) => v.price !== null) && <span className="pdp-muted mr-1 text-xs font-normal">a partir de</span>}
                  {moneyShort(price.price)}
                </p>
              </div>
              <FavoriteButton slug={slug} productId={p.id} name={p.name} className="pdp-icon-btn relative z-10 size-10" iconClassName="size-4" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
