import type { ComponentProps, CSSProperties } from "react";
import { cn } from "./ui";

// As fotos vêm do bucket público "media" do Supabase Storage;
// usamos <img> simples para não depender da configuração de domínios do next/image.
export function Img(props: ComponentProps<"img">) {
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img loading="lazy" decoding="async" {...props} />;
}

/** Foto principal do produto, ou o emoji quando ainda não há fotos. */
export function Thumb({ url, emoji, alt, className, emojiClassName, style }: { url: string | null | undefined; emoji: string; alt: string; className?: string; emojiClassName?: string; style?: CSSProperties }) {
  return (
    <span className={cn("bg-brand-soft grid shrink-0 place-items-center overflow-hidden", className)} style={style}>
      {url ? <Img src={url} alt={alt} className="size-full object-cover" /> : <span className={emojiClassName}>{emoji}</span>}
    </span>
  );
}

/** Fora da vitrine (landing, backoffice) passe `tinted` para usar a cor da própria loja no fundo. */
export function StoreLogo({ store, className, emojiClassName = "text-xl", tinted }: { store: { name: string; logo: string; logoUrl: string | null; brandColor?: string }; className?: string; emojiClassName?: string; tinted?: boolean }) {
  return <Thumb url={store.logoUrl} emoji={store.logo} alt={`Logo ${store.name}`} className={cn("rounded-xl", className)} emojiClassName={emojiClassName} style={tinted && store.brandColor ? { background: `${store.brandColor}18` } : undefined} />;
}
