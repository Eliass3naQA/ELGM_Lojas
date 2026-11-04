"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Hand, Maximize2, Minimize2, Minus, Pause, Play, Plus, Sparkles, X } from "lucide-react";
import { isLightScene, ringViews, VIEW_ANGLE, VIEW_LABEL, VIEW_SHORT } from "@/lib/showcase";
import type { Hotspot, Showcase, ShowcaseRingView, ShowcaseView, Spec } from "@/lib/types";
import { cn } from "../ui";
import { HOTSPOT_META } from "./hotspot-kinds";

// Showroom 360°: monta um giro contínuo a partir das fotos de cada ângulo.
// Entre duas fotos vizinhas, as imagens se cruzam com inclinação 3D, compressão e
// desfoque de movimento, o que dá a sensação de o produto estar girando.
// As vistas de cima/baixo giram de verdade (rotação 2D da foto aérea).
// Pontos interativos ficam presos à foto em que foram marcados e abrem fotos reais do detalhe.
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
const MAX_ZOOM = 3;

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

/** O que a galeria do produto comanda de fora: ir para um ângulo e ligar/desligar o giro automático. */
export type ShowroomControls = {
  goTo: (view: ShowcaseView) => void;
  setAutoplay: (on: boolean) => void;
};

export function Showroom({
  name,
  eyebrow,
  price,
  showcase,
  specs = [],
  brand,
  logoUrl = null,
  className,
  embedded = false,
  controls,
  onViewChange,
  onPlayingChange,
  hero = false,
  backdrop,
  restView,
  onReady,
}: {
  name: string;
  eyebrow?: string;
  price?: string;
  showcase: Showcase;
  specs?: Spec[];
  brand: string;
  logoUrl?: string | null;
  className?: string;
  /** Dentro da galeria do produto: preenche o pai, sem título nem ficha, e fica parado até pedirem o giro. */
  embedded?: boolean;
  controls?: React.Ref<ShowroomControls>;
  onViewChange?: (view: ShowcaseView) => void;
  onPlayingChange?: (playing: boolean) => void;
  /** Abertura da home: sempre escuro, sem nenhum controle; o carro é a peça central. */
  hero?: boolean;
  /** Fica atrás do carro e na frente da parede (o nome da loja, na abertura). */
  backdrop?: React.ReactNode;
  /** Ângulo em que o carro descansa depois da chegada. */
  restView?: ShowcaseRingView;
  onReady?: () => void;
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
  const hotspots = useMemo(() => (hero ? [] : (showcase.hotspots ?? []).filter((h) => showcase.views[h.view])), [showcase, hero]);
  const light = !hero && isLightScene(showcase.studio);
  const restAngle = restView && showcase.views[restView] ? VIEW_ANGLE[restView] : null;

  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const roadRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<SVGGElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const layerEls = useRef(new Map<string, HTMLDivElement>()); // `${key}` e `${key}:refl`
  const pillEls = useRef(new Map<string, HTMLButtonElement>()); // botões das vistas (destaque atualizado pelo loop)

  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(0);
  const ready = loaded >= layers.length;
  const [interacted, setInteracted] = useState(false);
  const [playing, setPlaying] = useState(!embedded);
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const [fullscreen, setFullscreen] = useState(false);
  const [elevation, setElevation] = useState<0 | 90 | -90>(0);
  const [detail, setDetail] = useState<{ hotspot: Hotspot; photo: number } | null>(null);

  const sim = useRef({
    theta: 0,
    phi: 0,
    phiTarget: 0,
    vel: 0,
    zoom: 1,
    zoomTarget: 1,
    panX: 0,
    panY: 0,
    target: null as number | null,
    pointers: new Map<number, { x: number; y: number }>(),
    mode: "none" as "none" | "rotate" | "pan" | "pinch",
    pinch: { dist: 0, zoom: 1, mx: 0, my: 0 },
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
    paused: false, // painel de detalhe aberto
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

  // HUD (nome, controles, pontos) controlado direto no DOM, como o resto da animação
  const showHud = useCallback((on: boolean) => {
    sim.current.hudShown = on;
    if (hudRef.current) hudRef.current.style.opacity = on ? "1" : "0";
    if (rootRef.current) rootRef.current.dataset.hud = on ? "1" : "0";
  }, []);

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
      s.theta = restAngle ?? s.theta;
      s.lastInteract = performance.now();
      showHud(true);
      return;
    }
    Object.assign(s, { introStart: performance.now(), introDone: false, theta: 0, phi: 0, phiTarget: 0, vel: 0, target: null, zoomTarget: 1, panX: 0, panY: 0, arrive: 0, turn: 0 });
    showHud(false);
    setElevation(0);
  }, [showcase.intro, showHud, restAngle]);

  /** Interrompe a chegada e deixa o produto no lugar, pronto para girar. */
  const skipIntro = useCallback(() => {
    const s = sim.current;
    if (s.introDone) return;
    s.introDone = true;
    s.introStart = null;
    s.arrive = 1;
    s.turn = 1;
    s.hlTarget = 0;
    if (!s.hudShown) showHud(true);
  }, [showHud]);

  useEffect(() => {
    if (!ready) return;
    startIntro();
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onReady é só um aviso, não reinicia a chegada
  }, [ready, startIntro]);

  useEffect(() => {
    sim.current.playing = playing;
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);

  useEffect(() => {
    sim.current.paused = !!detail;
  }, [detail]);

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

  // zoom com a roda do mouse: só com Ctrl (ou pinça do trackpad) ou em tela cheia, para não roubar a rolagem da página
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && document.fullscreenElement !== rootRef.current) return;
      e.preventDefault();
      const s = sim.current;
      s.zoomTarget = clamp(s.zoomTarget * Math.exp(-e.deltaY * 0.004), 1, MAX_ZOOM);
      s.lastInteract = performance.now();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // loop de animação
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    let prev = performance.now();
    const n = ring.length;
    const rest = hero ? 1.14 : embedded ? 1.25 : 1; // as fotos têm margem em volta do carro; no palco menor ele precisa ocupar mais

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
      // segura um pouco em cada foto exata; com fotos muito distantes entre si, a troca é mais curta para o carro não parecer um fantasma
      const span = gap > 60 ? 0.3 : 0.76;
      const w = smooth(clamp((t - (1 - span) / 2) / span));
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
          // uma foto só some depois que a outra já cobriu: o carro nunca fica transparente no meio do giro
          opacity = (i === a ? Math.min(1, 2 * (1 - w)) : i === b ? Math.min(1, 2 * w) : 0) * ringVis;
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
          // pontos interativos só aparecem quando a foto está parada e nítida
          if (!suffix) el.dataset.solid = o > 0.85 && blur < 0.3 ? "1" : "0";
        }
      }

      const arrive = s.arrive;
      if (carRef.current) {
        carRef.current.style.transform = `translate3d(${s.panX.toFixed(1)}px, calc(${(-(1 - arrive) * 16).toFixed(2)}% + ${s.panY.toFixed(1)}px), 0) scale(${((0.14 + 0.86 * arrive) * s.zoom * rest).toFixed(4)})`;
        carRef.current.style.filter = arrive < 1 ? `blur(${((1 - arrive) * 7).toFixed(2)}px) brightness(${(0.35 + 0.65 * arrive).toFixed(3)})` : "";
      }
      if (stageRef.current) stageRef.current.style.touchAction = s.zoomTarget > 1.02 ? "none" : "pan-y";
      if (roadRef.current) roadRef.current.style.backgroundPosition = `50% ${s.roadY.toFixed(1)}px, 0 0, 0 0`;
      root.style.setProperty("--hl", s.hl.toFixed(3));
      root.style.setProperty("--turn", s.turn.toFixed(3));
      root.style.setProperty("--road", (1 - s.turn).toFixed(3));
      root.dataset.zoomed = s.zoom > 1.05 ? "1" : "0";
      if (miniRef.current) miniRef.current.setAttribute("transform", `rotate(${(-th).toFixed(2)})`);

      // vista atual (destaca o botão direto no DOM)
      const current = topW > 0.5 ? "top" : botW > 0.5 ? "bottom" : (w < 0.5 ? ring[a] : ring[b]).key;
      if (current !== s.active) {
        s.active = current;
        for (const [v, el] of pillEls.current) el.dataset.active = v === current ? "1" : "0";
        onViewChangeRef.current?.(current);
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = sim.current;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!s.visible || s.paused) return;

      if (!s.introDone && s.introStart !== null) {
        const t = now - s.introStart;
        s.arrive = easeOut(clamp(t / ARRIVE));
        s.roadY += (1 - s.arrive) * 2600 * dt;
        s.turn = smooth(clamp((t - ARRIVE + 200) / 900));
        s.hl = headlightsAt(t);
        if (t > FLASH && !s.hudShown) showHud(true);
        if (t > SPIN_AT) {
          // na galeria a chegada termina com o carro parado e nítido; o giro fica para quando pedirem
          const p = embedded ? 1 : clamp((t - SPIN_AT) / SPIN);
          s.theta = 360 * easeInOut(p);
          if (p >= 1) {
            s.introDone = true;
            s.theta = 0;
            s.hlTarget = 0;
            s.lastInteract = now - 2500;
            if (restAngle !== null) s.target = restAngle;
          }
        } else s.theta = 0;
      } else {
        if (s.mode === "none") {
          if (s.target !== null) {
            const diff = shortest(s.theta, s.target);
            s.theta += diff * Math.min(1, dt * (hero ? 2.2 : 7));
            if (Math.abs(diff) < 0.2) {
              s.theta = s.target;
              s.target = null;
            }
          } else if (Math.abs(s.vel) > 0.5) {
            s.theta += s.vel * dt;
            s.vel *= Math.exp(-dt * 2.6);
          } else if (s.playing && !reduced.current && s.zoomTarget <= 1.02 && now - s.lastInteract > 3500) {
            s.theta += 9 * dt;
          } else if (n > 1) {
            // em repouso, encaixa na foto mais próxima: imagem nítida e pontos interativos visíveis
            let best = s.theta;
            let bestDist = Infinity;
            for (const l of ring) {
              const diff = shortest(s.theta, l.angle!);
              if (Math.abs(diff) < bestDist) {
                bestDist = Math.abs(diff);
                best = s.theta + diff;
              }
            }
            if (bestDist > 0.3) s.target = best;
          }
          s.phi += (s.phiTarget - s.phi) * Math.min(1, dt * 6);
        }
        s.hl += (s.hlTarget - s.hl) * Math.min(1, dt * 3);
      }
      s.zoom += (s.zoomTarget - s.zoom) * Math.min(1, dt * 8);
      // sem zoom, a imagem volta ao centro; com zoom, não deixa sair do quadro
      const stage = stageRef.current;
      if (stage) {
        const maxX = ((s.zoom - 1) * stage.clientWidth) / 2;
        const maxY = ((s.zoom - 1) * stage.clientHeight) / 2;
        s.panX = clamp(s.panX, -maxX, maxX);
        s.panY = clamp(s.panY, -maxY, maxY);
      }
      render();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [ready, ring, layers, hasTop, hasBottom, showHud, embedded, hero, restAngle]);

  // ---------------------------------------------------------------- interação
  const interact = () => {
    skipIntro();
    const s = sim.current;
    s.target = null;
    s.lastInteract = performance.now();
    if (!interacted) setInteracted(true);
  };

  const pinchInfo = () => {
    const [p1, p2] = [...sim.current.pointers.values()];
    return { dist: Math.hypot(p1.x - p2.x, p1.y - p2.y), mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    interact();
    const s = sim.current;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stageRef.current?.setPointerCapture(e.pointerId);
    if (s.pointers.size === 2) {
      // dois dedos: pinça para zoom (e arrastar move a imagem)
      const p = pinchInfo();
      s.mode = "pinch";
      s.pinch = { dist: p.dist, zoom: s.zoomTarget, mx: p.mx, my: p.my };
      s.vel = 0;
      return;
    }
    s.mode = s.zoomTarget > 1.02 ? "pan" : "rotate";
    s.vel = 0;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastT = performance.now();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = sim.current;
    if (!s.pointers.has(e.pointerId)) return;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const el = stageRef.current!;

    if (s.mode === "pinch" && s.pointers.size >= 2) {
      const p = pinchInfo();
      s.zoomTarget = clamp((s.pinch.zoom * p.dist) / Math.max(1, s.pinch.dist), 1, MAX_ZOOM);
      s.zoom = s.zoomTarget;
      s.panX += p.mx - s.pinch.mx;
      s.panY += p.my - s.pinch.my;
      s.pinch.mx = p.mx;
      s.pinch.my = p.my;
      return;
    }
    if (s.mode === "pan") {
      s.panX += e.clientX - s.lastX;
      s.panY += e.clientY - s.lastY;
    } else if (s.mode === "rotate") {
      const now = performance.now();
      const dt = Math.max(1, now - s.lastT) / 1000;
      const dTheta = ((e.clientX - s.lastX) / el.clientWidth) * 320;
      s.theta += dTheta;
      s.vel = 0.75 * s.vel + 0.25 * (dTheta / dt);
      if (e.pointerType !== "touch") {
        s.phi = clamp(s.phi - ((e.clientY - s.lastY) / el.clientHeight) * 190, hasBottom ? -90 : -18, hasTop ? 90 : 18);
      }
      s.lastT = now;
    }
    s.lastX = e.clientX;
    s.lastY = e.clientY;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const s = sim.current;
    if (!s.pointers.delete(e.pointerId)) return;
    s.lastInteract = performance.now();
    if (s.mode === "pinch") {
      // continua movendo a imagem com o dedo que sobrou
      const rest = [...s.pointers.values()][0];
      s.mode = rest ? "pan" : "none";
      if (rest) {
        s.lastX = rest.x;
        s.lastY = rest.y;
      }
      if (s.zoomTarget < 1.08) s.zoomTarget = 1;
      return;
    }
    if (s.pointers.size) return;
    if (s.mode === "rotate") {
      const next = s.phi > 45 && hasTop ? 90 : s.phi < -45 && hasBottom ? -90 : 0;
      s.phiTarget = next;
      setElevation(next as 0 | 90 | -90);
    }
    s.mode = "none";
  };

  const goTo = (view: ShowcaseView) => {
    interact();
    // quem escolheu um ângulo quer olhar para ele: o giro automático não pode tirar o carro dali
    if (embedded) setPlaying(false);
    const s = sim.current;
    s.zoomTarget = 1;
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

  useImperativeHandle(controls, () => ({
    goTo,
    setAutoplay: (on) => {
      skipIntro();
      const s = sim.current;
      s.target = null;
      s.zoomTarget = 1;
      s.phiTarget = 0;
      setElevation(0);
      if (on) s.lastInteract = 0; // começa a girar já, sem a espera de depois de uma interação
      setPlaying(on);
    },
  }));

  const zoom = (dir: 1 | -1) => {
    interact();
    const s = sim.current;
    s.zoomTarget = clamp(s.zoomTarget + dir * 0.4, 1, MAX_ZOOM);
  };

  const openDetail = (h: Hotspot) => {
    interact();
    sim.current.target = sim.current.theta + shortest(sim.current.theta, VIEW_ANGLE[h.view]);
    setDetail({ hotspot: h, photo: 0 });
  };

  const stepPhoto = (dir: 1 | -1) =>
    setDetail((d) => (d && d.hotspot.photos.length ? { ...d, photo: (d.photo + dir + d.hotspot.photos.length) % d.hotspot.photos.length } : d));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (detail) {
      const keys: Record<string, () => void> = { Escape: () => setDetail(null), ArrowLeft: () => stepPhoto(-1), ArrowRight: () => stepPhoto(1) };
      if (keys[e.key]) {
        e.preventDefault();
        keys[e.key]();
      }
      return;
    }
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
        className="showroom-layer absolute inset-0 grid will-change-transform [container-type:size]"
        style={{ placeItems: l.angle === null ? "center" : "end center", opacity: first && !refl ? 1 : 0, visibility: first ? "visible" : "hidden" }}
      >
        <div className="relative" style={{ width: `min(100cqw, calc(100cqh * ${r}))`, aspectRatio: String(r) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={l.url} alt={refl ? "" : `${name} — ${VIEW_LABEL[l.key]}`} draggable={false} className="absolute inset-0 size-full object-contain" />
          {l.key === "front" && !refl && showcase.headlights.map((h, i) => <span key={i} className="showroom-hl" style={{ left: `${h.x}%`, top: `${h.y}%` }} />)}
          {!refl &&
            hotspots
              .filter((h) => h.view === l.key)
              .map((h) => {
                const Icon = HOTSPOT_META[h.kind].icon;
                return (
                  <button
                    key={h.id}
                    type="button"
                    className="showroom-pin"
                    style={{ left: `${h.x}%`, top: `${h.y}%` }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => openDetail(h)}
                    aria-label={`Ver detalhes: ${h.label}`}
                  >
                    <span className="showroom-pin-dot">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="showroom-pin-label">{h.label}</span>
                  </button>
                );
              })}
        </div>
      </div>
    );
  };

  const viewButtons: ShowcaseView[] = [...ring.map((l) => l.key), ...(hasTop ? ["top" as const] : []), ...(hasBottom ? ["bottom" as const] : [])];
  const fg = light ? "text-zinc-900" : "text-white";
  const glassBtn = cn(
    "grid size-10 place-items-center rounded-full border backdrop-blur-md transition",
    light ? "border-zinc-900/10 bg-white/60 text-zinc-700 hover:bg-white hover:text-zinc-950" : "border-white/15 bg-white/[0.07] text-white/85 hover:bg-white/15 hover:text-white",
  );
  const glassPanel = light ? "border-zinc-900/10 bg-white/55" : "border-white/10 bg-white/[0.05]";
  const muted = light ? "text-zinc-500" : "text-white/50";
  const openPhoto = detail?.hotspot.photos[detail.photo];
  const bronze = embedded && !light; // estúdio aceso em tons quentes, combinando com a página do produto
  const stageBg = light ? "bg-[#ecebe7]" : bronze ? "bg-[#2a1f19]" : "bg-[#06070a]";

  return (
    <section
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={`Showroom 360° — ${name}. Arraste para girar.`}
      data-theme={light ? "light" : "dark"}
      data-tone={bronze ? "bronze" : undefined}
      data-hero={hero ? "1" : undefined}
      className={cn(
        "showroom relative isolate overflow-hidden outline-none select-none",
        stageBg,
        fg,
        fullscreen ? "h-screen" : embedded ? "h-full rounded-[32px]" : "h-[76vh] min-h-[540px] max-h-[880px] rounded-[36px] shadow-[0_40px_90px_-40px_rgb(0_0_0/0.8)]",
        className,
      )}
      style={{ "--brand": brand } as React.CSSProperties}
    >
      {/* ambiente */}
      <div className="showroom-ambient" />
      <div className="showroom-spot" />
      {bronze && !hero && <div className="showroom-arc" />}
      {backdrop}
      {showcase.studio === "logo" && logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="pointer-events-none absolute left-1/2 top-[7%] h-[13%] -translate-x-1/2 object-contain opacity-80" />
      )}
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
          sim.current.zoomTarget = sim.current.zoomTarget > 1.2 ? 1 : 2;
        }}
        className={cn(
          "absolute cursor-grab touch-pan-y active:cursor-grabbing",
          hero ? "inset-x-0 bottom-[30%] top-[30%] sm:inset-x-[12%] sm:bottom-[22%] sm:top-[31%]" : embedded && !fullscreen ? "inset-x-[2%] bottom-[14%] top-[10%] sm:bottom-[17%]" : "inset-x-[4%] bottom-[24%] top-[17%] sm:inset-x-[10%]",
        )}
      >
        <div className="showroom-turntable" />
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
      <div ref={hudRef} className={cn("pointer-events-none absolute inset-0 transition-opacity duration-1000", hero && "hidden")} style={{ opacity: 0 }}>
        <div className={cn("flex items-start justify-between gap-4", embedded ? "p-3 sm:p-4" : "p-5 sm:p-8")}>
          {embedded ? (
            <span />
          ) : (
            <div className="max-w-xl">
              <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] backdrop-blur-md", glassPanel, light ? "text-zinc-700" : "text-white/80")}>
                <span className="size-1.5 animate-pulse rounded-full bg-[var(--brand)] shadow-[0_0_10px_var(--brand)]" /> Showroom 360°
              </span>
              {eyebrow && <p className={cn("mt-4 text-xs font-medium uppercase tracking-[0.2em]", muted)}>{eyebrow}</p>}
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] sm:text-5xl">{name}</h2>
              {price && <p className={cn("mt-2 text-lg font-medium tabular-nums sm:text-xl", light ? "text-zinc-700" : "text-white/80")}>{price}</p>}
            </div>
          )}
          <div className="pointer-events-auto flex shrink-0 gap-2">
            <button type="button" onClick={startIntro} className={cn(glassBtn, "max-sm:hidden")} title="Ver a chegada de novo" aria-label="Ver a chegada de novo">
              <Sparkles className="size-4" />
            </button>
            {/* na galeria quem liga o giro é o bloco 360° ao lado das miniaturas, que não aparece em tela cheia */}
            {(!embedded || fullscreen) && (
              <button type="button" onClick={() => setPlaying((p) => !p)} className={glassBtn} title={playing ? "Pausar giro automático" : "Girar sozinho"} aria-label={playing ? "Pausar giro automático" : "Girar sozinho"}>
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
            )}
            <button type="button" onClick={toggleFullscreen} className={glassBtn} title="Tela cheia" aria-label="Tela cheia">
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </div>

        {/* ficha técnica */}
        {specs.length > 0 && !embedded && (
          <dl className={cn("absolute bottom-6 right-6 hidden w-[300px] grid-cols-2 gap-x-5 gap-y-3 rounded-3xl border p-5 backdrop-blur-md xl:grid", glassPanel)}>
            {specs.slice(0, 6).map((s) => (
              <div key={s.label}>
                <dt className={cn("text-[10px] font-semibold uppercase tracking-[0.2em]", light ? "text-zinc-500" : "text-white/45")}>{s.label}</dt>
                <dd className={cn("text-sm font-medium", light ? "text-zinc-900" : "text-white/90")}>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* bússola, vistas e detalhes */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2.5 p-3 sm:gap-3 sm:p-6">
          {!interacted && (
            <p className={cn("flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium backdrop-blur-md", light ? "bg-white/60 text-zinc-700" : "bg-black/30 text-white/80")}>
              <Hand className="showroom-hand size-4" /> Arraste para girar 360°
              {!embedded && <span className="max-sm:hidden">· pinça ou Ctrl + roda para zoom</span>}
            </p>
          )}
          {/* no celular o palco embutido é baixo: o zoom fica na pinça, para os botões não cobrirem o carro */}
          <div className={cn("pointer-events-auto flex items-center gap-3", embedded && !fullscreen && "max-sm:hidden")}>
            <button type="button" onClick={() => zoom(-1)} className={glassBtn} aria-label="Afastar">
              <Minus className="size-4" />
            </button>
            <div className={cn("relative grid place-items-center rounded-full border backdrop-blur-md", embedded ? "size-[52px]" : "size-[66px] sm:size-[74px]", glassPanel)}>
              <svg viewBox="-50 -50 100 100" className="size-full">
                {Array.from({ length: 24 }, (_, i) => (
                  <line key={i} x1="0" y1="-44" x2="0" y2={i % 6 === 0 ? -37 : -40} stroke="currentColor" strokeOpacity={i % 6 === 0 ? 0.5 : 0.2} strokeWidth="1.5" transform={`rotate(${i * 15})`} />
                ))}
                <circle cx="0" cy="44" r="3.5" fill="var(--brand)" />
                <g ref={miniRef}>
                  <rect x="-9" y="-20" width="18" height="40" rx="7" fill="currentColor" fillOpacity="0.9" />
                  <rect x="-7" y="-6" width="14" height="12" rx="3" fill={light ? "#ecebe7" : "#06070a"} fillOpacity="0.75" />
                  <rect x="-6" y="11" width="12" height="5" rx="2" fill={light ? "#ecebe7" : "#06070a"} fillOpacity="0.55" />
                </g>
              </svg>
            </div>
            <button type="button" onClick={() => zoom(1)} className={glassBtn} aria-label="Aproximar">
              <Plus className="size-4" />
            </button>
          </div>
          {hotspots.length > 0 && (
            <div className={cn("pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full border p-1 backdrop-blur-md [scrollbar-width:none]", glassPanel)}>
              {hotspots.map((h) => {
                const Icon = HOTSPOT_META[h.kind].icon;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => openDetail(h)}
                    className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition", light ? "text-zinc-700 hover:bg-white" : "text-white/80 hover:bg-white/10 hover:text-white")}
                  >
                    <Icon className="size-3.5 text-[var(--brand)]" /> {h.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className={cn("pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full border p-1 backdrop-blur-md [scrollbar-width:none]", glassPanel, embedded && !fullscreen && "hidden")}>
            {viewButtons.map((v) => (
              <button
                key={v}
                ref={(el) => {
                  if (el) pillEls.current.set(v, el);
                  else pillEls.current.delete(v);
                }}
                type="button"
                onClick={() => goTo(v)}
                data-active={v === ring[0]?.key ? "1" : "0"}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition",
                  light ? "text-zinc-600 hover:text-zinc-950 data-[active=1]:bg-zinc-950 data-[active=1]:text-white" : "text-white/70 hover:text-white data-[active=1]:bg-white data-[active=1]:text-zinc-950",
                )}
              >
                {VIEW_SHORT[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* detalhe do ponto interativo: fotos reais enviadas pelo vendedor */}
      {detail && (
        <div className={cn("absolute inset-0 z-20 flex flex-col backdrop-blur-xl animate-fade-up", light ? "bg-[#ecebe7]/90" : "bg-[#06070a]/88")} role="dialog" aria-label={detail.hotspot.label}>
          <div className="flex items-center gap-3 p-4 sm:p-6">
            {(() => {
              const Icon = HOTSPOT_META[detail.hotspot.kind].icon;
              return (
                <span className="grid size-10 place-items-center rounded-full bg-[var(--brand)] text-white shadow-[0_0_24px_-4px_var(--brand)]">
                  <Icon className="size-5" />
                </span>
              );
            })()}
            <div className="min-w-0 flex-1">
              <p className={cn("text-[11px] font-semibold uppercase tracking-[0.2em]", muted)}>{name}</p>
              <h3 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{detail.hotspot.label}</h3>
            </div>
            <button type="button" onClick={() => setDetail(null)} className={glassBtn} aria-label="Fechar detalhes">
              <X className="size-4" />
            </button>
          </div>
          <div className="relative min-h-0 flex-1 px-4 sm:px-16">
            {openPhoto ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={openPhoto} src={openPhoto} alt={`${detail.hotspot.label} — foto ${detail.photo + 1}`} className="animate-fade-up size-full rounded-2xl object-contain" />
                {detail.hotspot.photos.length > 1 && (
                  <>
                    <button type="button" onClick={() => stepPhoto(-1)} className={cn(glassBtn, "absolute left-2 top-1/2 -translate-y-1/2 sm:left-4")} aria-label="Foto anterior">
                      <ChevronLeft className="size-5" />
                    </button>
                    <button type="button" onClick={() => stepPhoto(1)} className={cn(glassBtn, "absolute right-2 top-1/2 -translate-y-1/2 sm:right-4")} aria-label="Próxima foto">
                      <ChevronRight className="size-5" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className={cn("grid size-full place-items-center text-sm", muted)}>Sem fotos deste detalhe.</div>
            )}
          </div>
          <div className="space-y-3 p-4 sm:p-6">
            {detail.hotspot.note && <p className={cn("mx-auto max-w-2xl text-center text-sm leading-relaxed", light ? "text-zinc-700" : "text-white/80")}>{detail.hotspot.note}</p>}
            {detail.hotspot.photos.length > 1 && (
              <div className="flex justify-center gap-2 overflow-x-auto [scrollbar-width:none]">
                {detail.hotspot.photos.map((p, i) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDetail((d) => d && { ...d, photo: i })}
                    className={cn("size-14 shrink-0 overflow-hidden rounded-xl ring-2 transition sm:size-16", i === detail.photo ? "ring-[var(--brand)]" : "opacity-60 ring-transparent hover:opacity-100")}
                    aria-label={`Foto ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* carregando */}
      <div className={cn("absolute inset-0 grid place-items-center transition-opacity duration-700", stageBg, ready ? "pointer-events-none opacity-0" : "opacity-100")}>
        <div className="w-56 text-center">
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.25em]", light ? "text-zinc-500" : "text-white/60")}>Preparando o showroom</p>
          <div className={cn("mt-4 h-0.5 overflow-hidden rounded-full", light ? "bg-zinc-900/10" : "bg-white/10")}>
            <div className="h-full bg-[var(--brand)] shadow-[0_0_12px_var(--brand)] transition-[width] duration-300" style={{ width: `${(loaded / Math.max(1, layers.length)) * 100}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
