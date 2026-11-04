"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Rotate3d } from "lucide-react";
import { hasShowroom, ringViews, VIEW_LABEL } from "@/lib/showcase";
import type { Product, ShowcaseView } from "@/lib/types";
import { Img } from "../media";
import { cn } from "../ui";
import { Showroom, type ShowroomControls } from "./showroom";

// Palco único: as miniaturas de ângulo comandam o showroom 360° e as demais fotos
// entram no mesmo lugar, sem o comprador precisar rolar entre dois visualizadores.

const thumbClass = "pdp-thumb relative aspect-[4/3] w-[92px] shrink-0 overflow-hidden rounded-2xl lg:w-full";

export function ProductGallery({ product, brand, logoUrl }: { product: Product; brand: string; logoUrl: string | null }) {
  const showroom = hasShowroom(product) ? product.showcase : null;
  const views = useMemo<ShowcaseView[]>(() => {
    if (!showroom) return [];
    return [...ringViews(showroom), ...(showroom.views.top ? ["top" as const] : []), ...(showroom.views.bottom ? ["bottom" as const] : [])];
  }, [showroom]);

  // fotos soltas que não sejam versões das mesmas vistas do giro (a principal costuma ser o recorte quadrado da frente)
  const photos = useMemo(() => {
    if (!showroom) return product.images;
    const known = new Set<string>(Object.values(showroom.views).filter((u): u is string => !!u));
    for (const s of Object.values(showroom.sources ?? {})) for (const u of [s?.original, s?.cutout, s?.stage, s?.square]) if (u) known.add(u);
    return product.images.filter((u) => !known.has(u));
  }, [showroom, product.images]);

  const [photo, setPhoto] = useState<number | null>(showroom ? null : 0); // null = showroom 360°
  const [view, setView] = useState<ShowcaseView>(views[0] ?? "front");
  const [spinning, setSpinning] = useState(false);
  const controls = useRef<ShowroomControls>(null);

  const pickView = (v: ShowcaseView) => {
    setPhoto(null);
    controls.current?.goTo(v);
  };
  const toggleSpin = () => {
    const on = photo !== null || !spinning;
    setPhoto(null);
    controls.current?.setAutoplay(on);
  };
  const step = (dir: 1 | -1) => setPhoto((p) => ((p ?? 0) + dir + photos.length) % photos.length);

  const spinTile = showroom && (
    <button type="button" onClick={toggleSpin} aria-pressed={photo === null && spinning} className={cn(thumbClass, "grid place-items-center", photo === null && spinning && "pdp-thumb-active")}>
      <span className="flex flex-col items-center gap-0.5 text-[13px] font-semibold">
        {photo === null && spinning ? <Pause className="size-5" /> : <Rotate3d className="size-5" />}
        {photo === null && spinning ? "Pausar" : "360°"}
      </span>
    </button>
  );

  const hasThumbs = views.length > 0 || photos.length > 1;

  return (
    <section aria-label={`Fotos de ${product.name}`} className="flex min-w-0 flex-col gap-2.5 lg:sticky lg:top-[88px] lg:h-[calc(100vh-108px)] lg:max-h-[780px] lg:min-h-[540px] lg:flex-row lg:gap-3">
      {hasThumbs && (
        <div className="order-2 flex min-w-0 gap-2 lg:order-1 lg:w-[104px] lg:shrink-0 lg:flex-col">
          <div className="no-scrollbar flex min-h-0 min-w-0 flex-1 gap-2 overflow-x-auto p-0.5 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
          {views.map((v) => (
            <button key={v} type="button" onClick={() => pickView(v)} title={VIEW_LABEL[v]} aria-label={`Ver ${VIEW_LABEL[v].toLowerCase()}`} aria-current={photo === null && view === v} className={cn(thumbClass, photo === null && view === v && "pdp-thumb-active")}>
              <Img src={showroom!.views[v]} alt="" className="absolute inset-0 size-full object-contain p-1" />
            </button>
          ))}
          {photos.length > (showroom ? 0 : 1) &&
            photos.map((url, i) => (
              <button key={url} type="button" onClick={() => setPhoto(i)} aria-label={`Foto ${i + 1}`} aria-current={photo === i} className={cn(thumbClass, photo === i && "pdp-thumb-active")}>
                <Img src={url} alt="" className="absolute inset-0 size-full object-cover" />
              </button>
            ))}
          </div>
          {/* fora da lista rolável: o giro continua à mão mesmo com muitas fotos */}
          {spinTile && <div className="shrink-0 p-0.5">{spinTile}</div>}
        </div>
      )}

      <div className="pdp-stage relative order-1 h-[66vw] max-h-[560px] min-h-[300px] min-w-0 overflow-hidden rounded-[32px] sm:h-[480px] lg:order-2 lg:h-auto lg:max-h-none lg:flex-1">
        {showroom && (
          <div className={cn("absolute inset-0", photo !== null && "hidden")}>
            <Showroom embedded controls={controls} name={product.name} showcase={showroom} brand={brand} logoUrl={logoUrl} onViewChange={setView} onPlayingChange={setSpinning} />
          </div>
        )}
        {photo !== null && (
          <>
            {photos[photo] ? (
              <Img key={photos[photo]} src={photos[photo]} alt={product.name} loading="eager" className="animate-fade-up absolute inset-0 size-full object-contain p-3 sm:p-6" />
            ) : (
              <span className="absolute inset-0 grid select-none place-items-center text-[9rem] leading-none sm:text-[13rem]">{product.image}</span>
            )}
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => step(-1)} className="pdp-icon-btn absolute left-3 top-1/2 size-11 -translate-y-1/2" aria-label="Foto anterior">
                  <ChevronLeft className="size-5" />
                </button>
                <button type="button" onClick={() => step(1)} className="pdp-icon-btn absolute right-3 top-1/2 size-11 -translate-y-1/2" aria-label="Próxima foto">
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
