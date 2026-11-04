"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { displayViews } from "@/lib/showcase";
import type { Showcase } from "@/lib/types";
import { Showroom } from "./showroom";

export type HeroItem = {
  id: string;
  name: string;
  price: string;
  showcase: Showcase | null; // só com recortes sem fundo: o carro pousa sobre o cenário
  photo: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** O nome da loja, letra a letra. No celular quebra por palavra e cresce pela maior delas. */
function StoreName({ name }: { name: string }) {
  const words = name.trim().split(/\s+/);
  let index = 0;
  return (
    <div aria-hidden className="hero-name" style={{ "--chars": name.length, "--chars-word": Math.max(...words.map((w) => w.length)) } as React.CSSProperties}>
      {words.map((word, w) => (
        <span key={w} className="hero-word">
          {[...word].map((char, c) => (
            <span key={c} className="hero-char" style={{ "--i": index++ } as React.CSSProperties}>
              {char}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

export function StoreHero({ name, tagline, category, slug, brand, logoUrl, items, vehicle, coverUrl }: {
  name: string;
  tagline: string;
  category: string;
  slug: string;
  brand: string;
  logoUrl: string | null;
  items: HeroItem[];
  vehicle: boolean;
  coverUrl: string | null;
}) {
  const heroRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const item = items[index] ?? null;
  const usesStage = !!item?.showcase;
  const [ready, setReady] = useState(!usesStage);
  const firstRun = useRef(true); // só a primeira visão tem a chegada; trocar de carro é imediato

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !heroRef.current) return;
    const r = heroRef.current.getBoundingClientRect();
    heroRef.current.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    heroRef.current.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  };

  const step = (dir: 1 | -1) => {
    firstRun.current = false;
    setIndex((i) => (i + dir + items.length) % items.length);
  };

  const photo = item?.photo ?? coverUrl;

  return (
    <section ref={heroRef} onPointerMove={onPointerMove} data-ready={ready ? "1" : "0"} aria-label={name} className="hero">
      <h1 className="sr-only">{name}</h1>

      {item?.showcase ? (
        <div className="absolute inset-0">
          <Showroom
            key={item.id}
            hero
            embedded
            name={item.name}
            brand={brand}
            logoUrl={logoUrl}
            showcase={{ ...item.showcase, intro: item.showcase.intro && firstRun.current }}
            restView={displayViews(item.showcase)[0]}
            onReady={() => setReady(true)}
            backdrop={
              <>
                <div className="hero-horizon" />
                <StoreName name={name} />
              </>
            }
          />
        </div>
      ) : (
        <>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photo} src={photo} alt="" className="hero-photo" />
          )}
          <div className="hero-shade" />
          <div className="hero-horizon" />
          <StoreName name={name} />
        </>
      )}

      {/* rodapé da abertura: uma frase e um caminho de cada lado */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 mx-auto grid max-w-[1512px] gap-6 px-5 pb-7 sm:px-8 sm:pb-9 md:grid-cols-[1fr_auto_1fr] md:items-end">
        <div className="hero-ui min-w-0 max-sm:hidden">
          <p className="eyebrow">{category}</p>
          {tagline && <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/80">{tagline}</p>}
        </div>

        <a href="#colecao" aria-label="Ver a coleção" className="hero-ui pointer-events-auto hidden justify-self-center p-2 md:block" style={{ "--delay": "2.8s" } as React.CSSProperties}>
          <span className="hero-scroll" />
        </a>

        <div className="hero-ui min-w-0 justify-self-stretch md:justify-self-end md:pr-16 md:text-right" style={{ "--delay": "2.5s" } as React.CSSProperties}>
          {item ? (
            <>
              <div className="flex items-center gap-3 md:justify-end">
                <p className="text-xs tabular-nums tracking-[0.2em] text-white/60">
                  {pad(index + 1)} <span className="text-white/30">/ {pad(items.length)}</span>
                </p>
                {items.length > 1 && (
                  <div className="pointer-events-auto flex gap-1">
                    <button type="button" onClick={() => step(-1)} className="pdp-icon-btn size-8" aria-label="Destaque anterior">
                      <ChevronLeft className="size-4" />
                    </button>
                    <button type="button" onClick={() => step(1)} className="pdp-icon-btn size-8" aria-label="Próximo destaque">
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                )}
              </div>
              <p key={item.id} className="animate-fade-up mt-2.5 text-lg font-medium leading-snug tracking-[-0.01em] text-white [text-wrap:balance] sm:text-xl">{item.name}</p>
              <p className="mt-0.5 text-[15px] tabular-nums text-white/70">{item.price}</p>
              <Link href={`/${slug}/produto/${item.id}`} className="link-arrow pointer-events-auto mt-4">
                <span className="link-underline">{vehicle ? "Ver este veículo" : "Ver este produto"}</span> <ArrowRight className="size-4" />
              </Link>
            </>
          ) : (
            <a href="#colecao" className="link-arrow pointer-events-auto">
              <span className="link-underline">Explorar a coleção</span> <ArrowRight className="size-4" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
