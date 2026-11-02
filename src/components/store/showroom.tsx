"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hand, Maximize2, Minimize2, Minus, Pause, Play, Plus, Sparkles } from "lucide-react";
import { ringViews, VIEW_ANGLE, VIEW_LABEL, VIEW_SHORT } from "@/lib/showcase";
import type { Showcase, ShowcaseRingView, ShowcaseView, Spec } from "@/lib/types";
import { cn } from "../ui";

// Showroom 360°: monta um giro contínuo a partir das fotos de cada ângulo.
// Entre duas fotos vizinhas, as imagens se cruzam com inclinação 3D, compressão e
// desfoque de movimento, o que dá a sensação de o produto estar girando.
// As vistas de cima/baixo giram de verdade (rotação 2D da foto aérea).
// A animação roda num loop de requestAnimationFrame que escreve direto no DOM.

type Layer = { key: ShowcaseView; url: string; angle: number | null };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const mod360 = (a: number) => ((a % 360) + 360) % 360;
const shortest = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

// linha do tempo da chegada (ms)
const ARRIVE = 2600;
const FLASH = 2750;
const SPIN_AT = 4300;
const SPIN = 6200;

/** Intensidade dos faróis durante a chegada: acesos, piscam duas vezes (farol alto) e baixam. */
function headlightsAt(t: number) {
  if (t < FLASH) return 0.8;
  const f = t - FLASH;
  if (f < 170) return 1.75;
  if (f < 330) return 0.3;
  if (f < 520) return 1.75;
  if (f < 700) return 0.45;
  return 0.95 - 0.75 * clamp((t - FLASH - 700) / 2600);
}

export function Showroom({
  name,
  eyebrow,
  price,
  showcase,
  specs = [],
  brand,
  className,
}: {
  name: string;
  eyebrow?: string;
  price?: string;
  showcase: Showcase;
  specs?: Spec[];
  brand: string;
  className?: string;
}) {
  const ring = useMemo<Layer[]>(() => ringViews(showcase).map((v) => ({ key: v, url: showcase.views[v]!, angle: VIEW_ANGLE[v] })), [showcase]);
  const layers = useMemo<Layer[]>(
    () => [
      ...ring,
      ...(showcase.views.top ? [{ key: "top" as const, url: showcase.views.top, angle: null }] : []),
      ...(showcase.views.bottom ? [{ key: "bottom" as const, url: showcase.views.bottom, angle: null }] : []),
    ],
    [ring, showcase.views.top, showcase.views.bottom],
  );
  const hasTop = !!showcase.views.top;
  const hasBottom = !!showcase.views.bottom;

  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const roadRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<SVGGElement>(null);
  const layerEls = useRef(new Map<string, HTMLDivElement>()); // `${key}` e `${key}:refl`

  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(0);
  const ready = loaded >= layers.length;
  const [hud, setHud] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [active, setActive] = useState<ShowcaseView>(ring[0]?.key ?? "front");
  const [elevation, setElevation] = useState<0 | 90 | -90>(0);

  const sim = useRef({
    theta: 0,
    phi: 0,
    phiTarget: 0,
    vel: 0,
    zoom: 1,
    zoomTarget: 1,
    target: null as number | null,
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    lastInteract: 0,
    introStart: null as number | null,
    introDone: false,
    hl: 0,
    hlTarget: 0,
    arrive: 1,
    turn: 1,
    roadY: 0,
    playing: true,
    visible: true,
    active: "" as string,
    hudShown: false,
  });

  // pré-carrega todas as fotos (e descobre a proporção de cada uma)
  useEffect(() => {
    let alive = true;
    setLoaded(0);
    for (const l of layers) {
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        setRatios((r) => ({ ...r, [l.key]: img.naturalWidth / img.naturalHeight || 1.6 }));
        setLoaded((n) => n + 1);
      };
      img.onerror = () => alive && setLoaded((n) => n + 1);
      img.src = l.url;
    }
    return () => {
      alive = false;
    };
  }, [layers]);

  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const startIntro = useCallback(() => {
    const s = sim.current;
    if (!showcase.intro || reduced.current) {
      s.introDone = true;
      s.arrive = 1;
      s.turn = 1;
      s.hl = s.hlTarget = 0;
      s.lastInteract = performance.now();
      s.hudShown = true;
      setHud(true);
      return;
    }
    Object.assign(s, { introStart: performance.now(), introDone: false, theta: 0, phi: 0, phiTarget: 0, vel: 0, target: null, zoomTarget: 1, arrive: 0, turn: 0, hudShown: false });
    setHud(false);
    setElevation(0);
  }, [showcase.intro]);

  /** Interrompe a chegada e deixa o produto no lugar, pronto para girar. */
  const skipIntro = useCallback(() => {
    const s = sim.current;
    if (s.introDone) return;
    s.introDone = true;
    s.introStart = null;
    s.arrive = 1;
    s.turn = 1;
    s.hlTarget = 0;
    if (!s.hudShown) {
      s.hudShown = true;
      setHud(true);
    }
  }, []);

  useEffect(() => {
    if (ready) startIntro();
  }, [ready, startIntro]);

  useEffect(() => {
    sim.current.playing = playing;
  }, [playing]);

  // pausa o loop fora da tela
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (sim.current.visible = e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // loop de animação
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    let prev = performance.now();
    const n = ring.length;

    const render = () => {
      const s = sim.current;
      const root = rootRef.current;
      if (!root) return;
      const th = mod360(s.theta);

      // duas fotos vizinhas do giro e o quanto já andamos entre elas
      let a = n - 1;
      for (let i = 0; i < n; i++) if (ring[i].angle! <= th) a = i;
      const b = (a + 1) % n;
      const gap = n === 1 ? 360 : mod360(ring[b].angle! - ring[a].angle!) || 360;
      const d = mod360(th - ring[a].angle!);
      const t = clamp(d / gap);
      const w = smooth(clamp((t - 0.12) / 0.76)); // segura um pouco em cada foto exata
      const topW = hasTop ? smooth(clamp((s.phi - 15) / 55)) : 0;
      const botW = hasBottom ? smooth(clamp((-s.phi - 15) / 55)) : 0;
      const ringVis = 1 - Math.max(topW, botW);
      const tilt = clamp(s.phi, -25, 25);
      const blur = n > 1 ? 2.4 * Math.sin(Math.PI * t) * Math.min(1, Math.abs(s.vel) / 60 + 0.35) : 0;

      for (const l of layers) {
        let opacity = 0;
        let transform = "";
        let filter = "";
        if (l.angle !== null) {
          const i = ring.indexOf(l);
          const delta = i === a ? d : i === b ? d - gap : 0;
          opacity = (i === a ? 1 - w : i === b ? w : 0) * ringVis;
          if (n === 1) opacity = ringVis;
          const squeeze = 1 - 0.16 * Math.min(1, Math.abs(delta) / gap);
          transform = `translateX(${delta * 0.11}%) rotateX(${-tilt * 0.35}deg) rotateY(${delta * 0.42}deg) scaleX(${squeeze})`;
          filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
        } else if (l.key === "top") {
          opacity = topW;
          transform = `rotate(${-th}deg) scale(${0.82 + 0.1 * topW})`;
        } else {
          opacity = botW;
          transform = `rotate(${th}deg) scale(${0.82 + 0.1 * botW})`;
        }
        for (const suffix of ["", ":refl"]) {
          const el = layerEls.current.get(l.key + suffix);
          if (!el) continue;
          const o = suffix && l.angle === null ? 0 : opacity;
          el.style.opacity = o.toFixed(3);
          el.style.visibility = o < 0.003 ? "hidden" : "visible";
          el.style.transform = transform;
          el.style.filter = filter;
        }
      }

      const arrive = s.arrive;
      if (carRef.current) {
        carRef.current.style.transform = `translate3d(0, ${(-(1 - arrive) * 16).toFixed(2)}%, 0) scale(${((0.14 + 0.86 * arrive) * s.zoom).toFixed(4)})`;
        carRef.current.style.filter = arrive < 1 ? `blur(${((1 - arrive) * 7).toFixed(2)}px) brightness(${(0.35 + 0.65 * arrive).toFixed(3)})` : "";
      }
      if (roadRef.current) roadRef.current.style.backgroundPosition = `50% ${s.roadY.toFixed(1)}px, 0 0, 0 0`;
      root.style.setProperty("--hl", s.hl.toFixed(3));
      root.style.setProperty("--turn", s.turn.toFixed(3));
      root.style.setProperty("--road", (1 - s.turn).toFixed(3));
      if (miniRef.current) miniRef.current.setAttribute("transform", `rotate(${(-th).toFixed(2)})`);

      // vista atual (só re-renderiza o React quando muda)
      const current = topW > 0.5 ? "top" : botW > 0.5 ? "bottom" : (w < 0.5 ? ring[a] : ring[b]).key;
      if (current !== s.active) {
        s.active = current;
        setActive(current);
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = sim.current;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!s.visible) return;

      if (!s.introDone && s.introStart !== null) {
        const t = now - s.introStart;
        s.arrive = easeOut(clamp(t / ARRIVE));
        s.roadY += (1 - s.arrive) * 2600 * dt;
        s.turn = smooth(clamp((t - ARRIVE + 200) / 900));
        s.hl = headlightsAt(t);
        if (t > FLASH && !s.hudShown) {
          s.hudShown = true;
          setHud(true);
        }
        if (t > SPIN_AT) {
          const p = clamp((t - SPIN_AT) / SPIN);
          s.theta = 360 * easeInOut(p);
          if (p >= 1) {
            s.introDone = true;
            s.theta = 0;
            s.hlTarget = 0;
            s.lastInteract = now - 2500;
          }
        } else s.theta = 0;
      } else {
        if (!s.dragging) {
          if (s.target !== null) {
            const diff = shortest(s.theta, s.target);
            s.theta += diff * Math.min(1, dt * 7);
            if (Math.abs(diff) < 0.2) {
              s.theta = s.target;
              s.target = null;
            }
          } else if (Math.abs(s.vel) > 0.5) {
            s.theta += s.vel * dt;
            s.vel *= Math.exp(-dt * 2.6);
          } else if (s.playing && !reduced.current && now - s.lastInteract > 3500) {
            s.theta += 9 * dt;
          }
          s.phi += (s.phiTarget - s.phi) * Math.min(1, dt * 6);
        }
        s.hl += (s.hlTarget - s.hl) * Math.min(1, dt * 3);
      }
      s.zoom += (s.zoomTarget - s.zoom) * Math.min(1, dt * 8);
      render();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [ready, ring, layers, hasTop, hasBottom]);

  // ---------------------------------------------------------------- interação
  const interact = () => {
    skipIntro();
    const s = sim.current;
    s.target = null;
    s.lastInteract = performance.now();
    if (!interacted) setInteracted(true);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    interact();
    const s = sim.current;
    s.dragging = true;
    s.vel = 0;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastT = performance.now();
    stageRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = sim.current;
    if (!s.dragging) return;
    const el = stageRef.current!;
    const now = performance.now();
    const dt = Math.max(1, now - s.lastT) / 1000;
    const dTheta = ((e.clientX - s.lastX) / el.clientWidth) * 320;
    s.theta += dTheta;
    s.vel = 0.75 * s.vel + 0.25 * (dTheta / dt);
    if (e.pointerType !== "touch") {
      s.phi = clamp(s.phi - ((e.clientY - s.lastY) / el.clientHeight) * 190, hasBottom ? -90 : -18, hasTop ? 90 : 18);
    }
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastT = now;
  };

  const onPointerUp = () => {
    const s = sim.current;
    if (!s.dragging) return;
    s.dragging = false;
    s.lastInteract = performance.now();
    const next = s.phi > 45 && hasTop ? 90 : s.phi < -45 && hasBottom ? -90 : 0;
    s.phiTarget = next;
    setElevation(next as 0 | 90 | -90);
  };

  const goTo = (view: ShowcaseView) => {
    interact();
    const s = sim.current;
    if (view === "top" || view === "bottom") {
      const next = view === "top" ? 90 : -90;
      s.phiTarget = next;
      setElevation(next);
      return;
    }
    s.phiTarget = 0;
    setElevation(0);
    s.target = s.theta + shortest(s.theta, VIEW_ANGLE[view as ShowcaseRingView]);
    s.vel = 0;
  };

  const zoom = (dir: 1 | -1) => {
    interact();
    const s = sim.current;
    s.zoomTarget = clamp(s.zoomTarget + dir * 0.35, 1, 2.4);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = sim.current;
    const step: Record<string, () => void> = {
      ArrowLeft: () => (s.target = (s.target ?? s.theta) - 45),
      ArrowRight: () => (s.target = (s.target ?? s.theta) + 45),
      ArrowUp: () => hasTop && goTo(elevation === -90 ? "front" : "top"),
      ArrowDown: () => hasBottom && goTo(elevation === 90 ? "front" : "bottom"),
      "+": () => zoom(1),
      "-": () => zoom(-1),
    };
    if (!step[e.key]) return;
    e.preventDefault();
    interact();
    step[e.key]();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  };

  const register = (key: string) => (el: HTMLDivElement | null) => {
    if (el) layerEls.current.set(key, el);
    else layerEls.current.delete(key);
  };

  const renderLayer = (l: Layer, refl: boolean) => {
    const r = ratios[l.key] ?? 1.6;
    const first = l.key === ring[0]?.key;
    return (
      <div
        key={l.key + (refl ? ":refl" : "")}
        ref={register(l.key + (refl ? ":refl" : ""))}
        className="absolute inset-0 grid will-change-transform [container-type:size]"
        style={{ placeItems: l.angle === null ? "center" : "end center", opacity: first && !refl ? 1 : 0, visibility: first ? "visible" : "hidden" }}
      >
        <div className="relative" style={{ width: `min(100cqw, calc(100cqh * ${r}))`, aspectRatio: String(r) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={l.url} alt={refl ? "" : `${name} — ${VIEW_LABEL[l.key]}`} draggable={false} className="absolute inset-0 size-full object-contain" />
          {l.key === "front" && !refl && showcase.headlights.map((h, i) => <span key={i} className="showroom-hl" style={{ left: `${h.x}%`, top: `${h.y}%` }} />)}
        </div>
      </div>
    );
  };

  const viewButtons: ShowcaseView[] = [...ring.map((l) => l.key), ...(hasTop ? ["top" as const] : []), ...(hasBottom ? ["bottom" as const] : [])];
  const isActive = (v: ShowcaseView) => active === v;
  const glassBtn = "grid size-10 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white/85 backdrop-blur-md transition hover:bg-white/15 hover:text-white";

  return (
    <section
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={`Showroom 360° — ${name}. Arraste para girar.`}
      className={cn(
        "showroom relative isolate overflow-hidden bg-[#06070a] text-white outline-none select-none",
        fullscreen ? "h-screen" : "h-[76vh] min-h-[540px] max-h-[880px] rounded-[36px] shadow-[0_40px_90px_-40px_rgb(0_0_0/0.8)]",
        className,
      )}
      style={{ "--brand": brand } as React.CSSProperties}
    >
      {/* ambiente */}
      <div className="showroom-ambient" />
      <div className="showroom-spot" />
      <div ref={roadRef} className="showroom-road" />
      <div className="showroom-floor" />
      <div className="showroom-dust" />

      {/* palco */}
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => {
          interact();
          sim.current.zoomTarget = sim.current.zoomTarget > 1.2 ? 1 : 1.8;
        }}
        className="absolute inset-x-[4%] bottom-[24%] top-[17%] cursor-grab touch-pan-y active:cursor-grabbing sm:inset-x-[10%]"
      >
        <div ref={carRef} className="absolute inset-0 origin-[50%_85%] [perspective:1600px]" style={{ transform: "scale(0.14)" }}>
          <div className="showroom-shadow" />
          {layers.map((l) => renderLayer(l, false))}
          {/* reflexo no piso */}
          <div className="pointer-events-none absolute inset-x-0 top-full h-full -scale-y-100 opacity-25 [mask-image:linear-gradient(to_top,#000,transparent_38%)]">
            {ring.map((l) => renderLayer(l, true))}
          </div>
        </div>
      </div>
      <div className="showroom-bloom" />

      {/* HUD */}
      <div className={cn("pointer-events-none absolute inset-0 transition-opacity duration-1000", hud ? "opacity-100" : "opacity-0")}>
        <div className="flex items-start justify-between gap-4 p-5 sm:p-8">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80 backdrop-blur-md">
              <span className="size-1.5 animate-pulse rounded-full bg-[var(--brand)] shadow-[0_0_10px_var(--brand)]" /> Showroom 360°
            </span>
            {eyebrow && <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-white/50">{eyebrow}</p>}
            <h2 className="mt-1 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">{name}</h2>
            {price && <p className="mt-2 text-lg font-medium text-white/80 tabular-nums sm:text-xl">{price}</p>}
          </div>
          <div className="pointer-events-auto flex gap-2">
            <button type="button" onClick={startIntro} className={glassBtn} title="Ver a chegada de novo" aria-label="Ver a chegada de novo">
              <Sparkles className="size-4" />
            </button>
            <button type="button" onClick={() => setPlaying((p) => !p)} className={glassBtn} title={playing ? "Pausar giro automático" : "Girar sozinho"} aria-label={playing ? "Pausar giro automático" : "Girar sozinho"}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <button type="button" onClick={toggleFullscreen} className={glassBtn} title="Tela cheia" aria-label="Tela cheia">
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </div>

        {/* ficha técnica */}
        {specs.length > 0 && (
          <dl className="absolute right-8 top-1/2 hidden w-60 -translate-y-1/2 space-y-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md xl:block">
            {specs.slice(0, 6).map((s) => (
              <div key={s.label}>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{s.label}</dt>
                <dd className="text-sm font-medium text-white/90">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* bússola + vistas */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4 sm:p-6">
          {!interacted && (
            <p className="flex items-center gap-2 rounded-full bg-black/30 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-md">
              <Hand className="showroom-hand size-4" /> Arraste para girar 360°
            </p>
          )}
          <div className="pointer-events-auto flex items-center gap-3">
            <button type="button" onClick={() => zoom(-1)} className={glassBtn} aria-label="Afastar">
              <Minus className="size-4" />
            </button>
            <div className="relative grid size-[74px] place-items-center rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-md" title={VIEW_LABEL[active]}>
              <svg viewBox="-50 -50 100 100" className="size-full">
                {Array.from({ length: 24 }, (_, i) => (
                  <line key={i} x1="0" y1="-44" x2="0" y2={i % 6 === 0 ? -37 : -40} stroke="white" strokeOpacity={i % 6 === 0 ? 0.5 : 0.2} strokeWidth="1.5" transform={`rotate(${i * 15})`} />
                ))}
                <circle cx="0" cy="44" r="3.5" fill="var(--brand)" />
                <g ref={miniRef}>
                  <rect x="-9" y="-20" width="18" height="40" rx="7" fill="white" fillOpacity="0.9" />
                  <rect x="-7" y="-6" width="14" height="12" rx="3" fill="#06070a" fillOpacity="0.75" />
                  <rect x="-6" y="11" width="12" height="5" rx="2" fill="#06070a" fillOpacity="0.55" />
                </g>
              </svg>
            </div>
            <button type="button" onClick={() => zoom(1)} className={glassBtn} aria-label="Aproximar">
              <Plus className="size-4" />
            </button>
          </div>
          <div className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.05] p-1 backdrop-blur-md [scrollbar-width:none]">
            {viewButtons.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => goTo(v)}
                className={cn("whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition", isActive(v) ? "bg-white text-zinc-950" : "text-white/70 hover:text-white")}
              >
                {VIEW_SHORT[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* carregando */}
      <div className={cn("absolute inset-0 grid place-items-center bg-[#06070a] transition-opacity duration-700", ready ? "pointer-events-none opacity-0" : "opacity-100")}>
        <div className="w-56 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/60">Preparando o showroom</p>
          <div className="mt-4 h-0.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-[var(--brand)] shadow-[0_0_12px_var(--brand)] transition-[width] duration-300" style={{ width: `${(loaded / Math.max(1, layers.length)) * 100}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
