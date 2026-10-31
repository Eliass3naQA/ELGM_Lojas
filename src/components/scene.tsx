import { cn } from "./ui";

type SceneVariant = "interior" | "dusk" | "daylight";

// Formas desfocadas que sugerem o ambiente atrás do vidro (janelas, móveis, luzes).
const shapes: Record<SceneVariant, { className: string; style: React.CSSProperties }[]> = {
  interior: [
    { className: "left-[6%] top-[-5%] h-[60%] w-[18%]", style: { background: "rgb(255 252 245 / .9)" } },
    { className: "left-[30%] top-[-8%] h-[38%] w-[14%]", style: { background: "rgb(120 80 50 / .7)" } },
    { className: "right-[8%] top-[-6%] h-[42%] w-[16%]", style: { background: "rgb(112 76 48 / .65)" } },
    { className: "bottom-[-8%] left-[38%] h-[30%] w-[40%]", style: { background: "rgb(70 52 38 / .5)" } },
    { className: "bottom-[10%] right-[-4%] h-[40%] w-[12%]", style: { background: "rgb(60 88 54 / .45)" } },
    { className: "left-[55%] top-[20%] h-[8%] w-[22%]", style: { background: "rgb(255 236 200 / .8)" } },
  ],
  dusk: [
    { className: "bottom-[-5%] left-[5%] h-[38%] w-[10%]", style: { background: "rgb(56 48 80 / .55)" } },
    { className: "bottom-[-5%] left-[20%] h-[52%] w-[7%]", style: { background: "rgb(48 40 72 / .5)" } },
    { className: "bottom-[-5%] right-[12%] h-[60%] w-[9%]", style: { background: "rgb(52 44 76 / .5)" } },
    { className: "right-[30%] top-[8%] h-[20%] w-[30%]", style: { background: "rgb(255 190 130 / .5)" } },
    { className: "left-[40%] top-[30%] h-[6%] w-[30%]", style: { background: "rgb(255 220 170 / .6)" } },
  ],
  daylight: [
    { className: "right-[6%] top-[-6%] h-[70%] w-[22%]", style: { background: "rgb(220 236 255 / .9)" } },
    { className: "left-[-4%] top-[20%] h-[50%] w-[14%]", style: { background: "rgb(190 182 170 / .5)" } },
    { className: "bottom-[-10%] left-[30%] h-[26%] w-[50%]", style: { background: "rgb(255 255 255 / .8)" } },
    { className: "bottom-[5%] right-[-5%] h-[35%] w-[14%]", style: { background: "rgb(96 120 84 / .25)" } },
  ],
};

/** Fundo fixo de página inteira. Com `imageUrl` (ex.: capa da loja), usa a foto desfocada como ambiente. */
export function Scene({ variant, imageUrl }: { variant: SceneVariant; imageUrl?: string | null }) {
  return (
    <div aria-hidden className="scene">
      <div className={cn("scene-blur", `scene-${variant}`)} />
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="inset-[-8%] size-[116%] object-cover opacity-80 blur-[48px] saturate-[1.2]" />
          <div className="inset-0 bg-white/25" />
        </>
      ) : (
        shapes[variant].map((s, i) => <div key={i} className={cn("scene-shape", s.className)} style={s.style} />)
      )}
      <div className="scene-grain" />
    </div>
  );
}
