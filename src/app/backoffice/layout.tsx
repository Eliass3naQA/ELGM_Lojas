import { AppShell, type NavItem } from "@/components/sidebar";
import { Scene } from "@/components/scene";

// dados sempre frescos (métricas em tempo real)
export const dynamic = "force-dynamic";

export const metadata = { title: { default: "Backoffice", template: "%s · Backoffice LojaFlow" } };

const nav: NavItem[] = [
  { href: "/backoffice", label: "Visão geral", icon: "BarChart3" },
  { href: "/backoffice/lojas", label: "Lojas", icon: "Store" },
  { href: "/backoffice/pedidos", label: "Pedidos", icon: "ShoppingBag" },
  { href: "/backoffice/planos", label: "Planos & receita", icon: "CreditCard" },
  { href: "/backoffice/auditoria", label: "Auditoria", icon: "ScrollText" },
];

// TODO(auth): restringir a usuários com role "platform_admin" (Supabase Auth + claims) e usar o nome real.
export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Scene variant="dusk" />
      <AppShell
        subtitle="Backoffice"
        nav={nav}
        footerLink={{ href: "/", label: "Site da plataforma" }}
        user={{ name: "Equipe LojaFlow", role: "Administração da plataforma" }}
        notifications={{ count: 0, href: "/backoffice/auditoria", label: "Atividade recente" }}
        brand={
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-zinc-950 text-base font-bold text-white shadow-[0_8px_20px_-8px_rgb(0_0_0/0.6)]">L</span>
            <span className="brand-name text-[15px] font-semibold tracking-tight text-zinc-900">LojaFlow</span>
          </div>
        }
      >
        {children}
      </AppShell>
    </>
  );
}
