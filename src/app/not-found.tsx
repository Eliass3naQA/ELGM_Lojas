import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { Scene } from "@/components/scene";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <Scene variant="interior" />
      <div className="glass rounded-[32px] px-10 py-12">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-white/85 shadow-sm">
          <Compass className="size-7 text-zinc-700" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Página não encontrada</h1>
        <p className="mt-1 text-sm text-zinc-500">A loja ou página que você procura não existe.</p>
        <ButtonLink href="/" className="mt-7">
          Voltar ao início
        </ButtonLink>
      </div>
    </main>
  );
}
