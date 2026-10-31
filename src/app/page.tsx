import Link from "next/link";
import { StoreLogo } from "@/components/media";
import { ArrowRight, BarChart3, Boxes, Check, ShieldCheck, Sparkles, Truck, Zap } from "lucide-react";
import { listPlans, listStores } from "@/lib/data/repository";
import { money } from "@/lib/format";
import { ButtonLink, Card, StoreStatusBadge, cn } from "@/components/ui";
import { Scene } from "@/components/scene";

export const dynamic = "force-dynamic";

const features = [
  { icon: Zap, title: "Loja no ar em minutos", text: "Seu endereço próprio em /sua-loja, com a sua marca e cores." },
  { icon: Sparkles, title: "Insights inteligentes", text: "Alertas de estoque, clientes sumidos, oportunidades de frete grátis." },
  { icon: Truck, title: "Pedidos e envios", text: "Fluxo completo do pagamento à entrega, com rastreio." },
  { icon: BarChart3, title: "Vendas em tempo real", text: "Faturamento, ticket médio, campeões de venda e mais." },
  { icon: Boxes, title: "Catálogo simples", text: "Cadastre produtos, preços promocionais e estoque." },
  { icon: ShieldCheck, title: "Seguro e escalável", text: "Pronto para Supabase com isolamento por loja." },
];

export default async function LandingPage() {
  const [stores, plans] = await Promise.all([listStores(), listPlans()]);

  return (
    <main className="min-h-screen px-3 pb-6 sm:px-6">
      <Scene variant="interior" />
      <header className="sticky top-3 z-20 mx-auto mt-3 max-w-6xl sm:top-4 sm:mt-4">
        <div className="glass flex h-16 items-center justify-between rounded-full pl-3 pr-2">
          <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
            <span className="grid size-10 place-items-center rounded-full bg-zinc-950 font-bold text-white">L</span> LojaFlow
          </Link>
          <nav className="flex items-center gap-1.5">
            <ButtonLink href="/backoffice" variant="ghost" className="hidden sm:inline-flex">
              Backoffice
            </ButtonLink>
            <ButtonLink href="#demo">Ver lojas demo</ButtonLink>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-3 pb-16 pt-20 text-center sm:pt-28">
        <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-700">
          <span className="orb size-3.5 rounded-full" /> Comércio inteligente para pequenas marcas
        </span>
        <h1 className="mt-7 text-5xl font-semibold leading-[1.02] tracking-[-0.035em] text-zinc-950 sm:text-7xl">
          Sua loja online,
          <br />
          <span className="text-zinc-950/45">sem complicação.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-600">Vitrine elegante para seus clientes, painel completo para você e inteligência para vender mais.</p>
        <div className="mt-9 flex justify-center gap-3">
          <ButtonLink href="#demo" className="px-6 py-3">
            Explorar demo <ArrowRight className="size-4" />
          </ButtonLink>
          <ButtonLink href="#planos" variant="outline" className="px-6 py-3">
            Ver planos
          </ButtonLink>
        </div>
      </section>

      <section className="glass-sheet mx-auto grid max-w-6xl gap-3 rounded-[36px] p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, text }) => (
          <Card key={title} className="p-6">
            <span className="grid size-11 place-items-center rounded-full bg-white/85 shadow-sm">
              <Icon className="size-5 text-zinc-800" />
            </span>
            <h3 className="mt-5 font-semibold tracking-tight text-zinc-950">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">{text}</p>
          </Card>
        ))}
      </section>

      <section id="demo" className="mx-auto max-w-6xl scroll-mt-24 pt-24">
        <h2 className="text-3xl font-semibold tracking-[-0.02em] text-zinc-950">Lojas de demonstração</h2>
        <p className="mt-1 text-sm text-zinc-600">Cada loja tem a vitrine em /loja/home e o painel do dono em /loja/painel.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {stores.map((s) => (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex items-center gap-3">
                <StoreLogo store={s} tinted className="size-12 rounded-2xl ring-1 ring-white" emojiClassName="text-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tracking-tight text-zinc-950">{s.name}</p>
                  <p className="truncate text-xs text-zinc-500">/{s.slug}</p>
                </div>
                <StoreStatusBadge status={s.status} />
              </div>
              <p className="mt-4 flex-1 text-sm text-zinc-600">{s.tagline}</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <ButtonLink href={`/${s.slug}/home`} variant="outline" className="text-xs">
                  Vitrine
                </ButtonLink>
                <ButtonLink href={`/${s.slug}/painel`} className="text-xs">
                  Painel do dono
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section id="planos" className="mx-auto max-w-6xl scroll-mt-24 pt-24">
        <h2 className="text-center text-3xl font-semibold tracking-[-0.02em] text-zinc-950">Planos que crescem com você</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const pro = p.id === "pro";
            return (
              <div key={p.id} className={cn("relative rounded-[30px] p-7", pro ? "bg-zinc-950 text-white shadow-[0_40px_60px_-30px_rgb(0_0_0/0.6)]" : "glass")}>
                {pro && <span className="absolute right-6 top-6 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">Mais popular</span>}
                <p className="font-semibold">{p.name}</p>
                <p className="mt-4 text-4xl font-semibold tracking-[-0.03em]">
                  {money(p.priceMonthly)}
                  <span className={cn("text-sm font-normal", pro ? "text-white/60" : "text-zinc-500")}>/mês</span>
                </p>
                <p className={cn("text-xs", pro ? "text-white/60" : "text-zinc-500")}>+ {p.feePercent}% por venda</p>
                <ul className={cn("mt-6 space-y-2.5 text-sm", pro ? "text-white/85" : "text-zinc-600")}>
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 opacity-70" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mx-auto mt-20 max-w-6xl">
        <div className="glass rounded-full py-5 text-center text-xs text-zinc-500">© {new Date().getFullYear()} LojaFlow</div>
      </footer>
    </main>
  );
}
