import clsx from "clsx";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight, Info, Sparkles, XCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { orderStatusLabel, paymentStatusLabel, pct, storeStatusLabel } from "@/lib/format";
import type { Insight, OrderStatus, PaymentStatus, StoreStatus } from "@/lib/types";

export const cn = clsx;

export function Card({ className, ...props }: ComponentProps<"div">) {
  // min-w-0: dentro de grids, conteúdo que não quebra (badges, tabelas) não alarga a página
  return <div className={cn("glass min-w-0 rounded-[26px]", className)} {...props} />;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Link discreto "Ver todos" no canto dos cards. */
export function CardLink({ href, children = "Ver todos" }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-1 text-xs font-medium text-zinc-500 transition hover:bg-white/70 hover:text-zinc-900">
      {children} <ChevronRight className="size-3.5" />
    </Link>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-sm text-zinc-500">{eyebrow}</p>}
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-zinc-900 sm:text-[34px]">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-zinc-500">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

const buttonVariants = {
  primary: "bg-zinc-950 text-white shadow-[0_8px_20px_-8px_rgb(0_0_0/0.5)] hover:bg-zinc-800",
  brand: "bg-[var(--brand)] text-white shadow-[0_8px_20px_-8px_var(--brand)] hover:brightness-110",
  outline: "border border-white/80 bg-white/70 text-zinc-800 shadow-sm backdrop-blur hover:bg-white",
  ghost: "text-zinc-700 hover:bg-white/60",
  danger: "bg-red-600 text-white shadow-[0_8px_20px_-8px_rgb(220_38_38/0.6)] hover:bg-red-500",
};
type ButtonVariant = keyof typeof buttonVariants;
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={cn(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={cn(buttonBase, buttonVariants[variant], className)} {...props} />;
}

const field =
  "w-full rounded-2xl border border-white/80 bg-white/65 px-3.5 py-2.5 text-sm text-zinc-900 shadow-[inset_0_1px_2px_rgb(0_0_0/0.04)] outline-none transition placeholder:text-zinc-400 focus:border-white focus:bg-white/90 focus:ring-4 focus:ring-[color-mix(in_srgb,var(--brand)_18%,transparent)]";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(field, className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(field, "min-h-24", className)} {...props} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(field, "appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2212%22%20height=%2212%22%20fill=%22none%22%20stroke=%22%2371717a%22%20stroke-width=%222%22%3E%3Cpath%20d=%22m3%204.5%203%203%203-3%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_0.9rem_center] bg-no-repeat pr-9", className)} {...props} />;
}
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="pl-1 text-xs font-medium text-zinc-600">{label}</span>
      {children}
      {hint && <span className="block pl-1 text-xs text-zinc-400">{hint}</span>}
    </label>
  );
}

const badgeTones = {
  zinc: "bg-zinc-900/[0.06] text-zinc-600 [--dot:#a1a1aa]",
  green: "bg-emerald-500/12 text-emerald-700 [--dot:#10b981]",
  yellow: "bg-amber-500/15 text-amber-700 [--dot:#f59e0b]",
  blue: "bg-sky-500/12 text-sky-700 [--dot:#0ea5e9]",
  violet: "bg-violet-500/12 text-violet-700 [--dot:#8b5cf6]",
  red: "bg-red-500/12 text-red-700 [--dot:#ef4444]",
};
export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "zinc", dot = true, children, className }: { tone?: BadgeTone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-[var(--dot)]" />}
      {children}
    </span>
  );
}

const orderTone: Record<OrderStatus, BadgeTone> = { pending: "yellow", paid: "blue", shipped: "violet", delivered: "green", cancelled: "red" };
export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => <Badge tone={orderTone[status]}>{orderStatusLabel[status]}</Badge>;

const paymentTone: Record<PaymentStatus, BadgeTone> = { awaiting: "zinc", in_review: "yellow", approved: "green", rejected: "red", cancelled: "zinc" };
export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => <Badge tone={paymentTone[status]}>{paymentStatusLabel[status]}</Badge>;

const storeTone: Record<StoreStatus, BadgeTone> = { active: "green", trial: "blue", suspended: "red" };
export const StoreStatusBadge = ({ status }: { status: StoreStatus }) => <Badge tone={storeTone[status]}>{storeStatusLabel[status]}</Badge>;

/** Variação percentual em pílula verde/vermelha. */
export function Growth({ value, light }: { value: number; light?: boolean }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
        light ? "bg-white/20 text-white" : up ? "bg-emerald-500/12 text-emerald-700" : "bg-red-500/12 text-red-700",
      )}
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {pct(value)}
    </span>
  );
}

/** KPI. `accent` pinta o card com a cor da marca (destaque, um por linha). */
export function StatCard({ label, value, growth, hint, icon, accent }: { label: string; value: string; growth?: number; hint?: string; icon?: ReactNode; accent?: boolean }) {
  return (
    <div
      className={cn(
        "animate-fade-up relative min-w-0 overflow-hidden rounded-[26px] p-5",
        accent ? "bg-brand-gradient border border-white/25 text-white shadow-[0_24px_40px_-20px_var(--brand)]" : "glass",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("text-[13px] font-medium", accent ? "text-white/85" : "text-zinc-600")}>{label}</span>
        {icon && (
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-4", accent ? "bg-white/20 text-white" : "bg-white/80 text-zinc-700 shadow-sm")}>{icon}</span>
        )}
      </div>
      <div className={cn("mt-4 text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums", accent ? "text-white" : "text-zinc-900")}>{value}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {growth !== undefined && <Growth value={growth} light={accent} />}
        {hint && <span className={accent ? "text-white/75" : "text-zinc-500"}>{hint}</span>}
      </div>
    </div>
  );
}

const insightStyle = {
  info: { icon: Info, cls: "text-sky-600 bg-sky-500/12" },
  success: { icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-500/12" },
  warning: { icon: AlertTriangle, cls: "text-amber-600 bg-amber-500/15" },
  danger: { icon: XCircle, cls: "text-red-600 bg-red-500/12" },
};

export function InsightList({ insights }: { insights: Insight[] }) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="orb size-4 rounded-full" /> Insights inteligentes
          </span>
        }
        description="Gerados automaticamente a partir dos seus dados"
      />
      {insights.length === 0 ? (
        <p className="flex flex-1 items-center justify-center gap-2 px-6 py-10 text-sm text-zinc-500">
          <Sparkles className="size-4" /> Tudo em ordem por aqui
        </p>
      ) : (
        <ul className="max-h-[310px] space-y-1.5 overflow-y-auto px-3 pb-3 pt-1 [scrollbar-color:rgb(0_0_0/0.15)_transparent] [scrollbar-width:thin]">
          {insights.map((ins, i) => {
            const { icon: Icon, cls } = insightStyle[ins.level];
            const body = (
              <div className="flex gap-3 rounded-2xl px-3 py-3 transition">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", cls)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{ins.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{ins.detail}</p>
                </div>
              </div>
            );
            return (
              <li key={i} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                {ins.href ? (
                  <Link href={ins.href} className="block rounded-2xl transition hover:bg-white/60">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-white/70 shadow-sm">
        <Sparkles className="size-5 text-zinc-400" />
      </span>
      <p className="text-sm font-medium text-zinc-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Tabela no estilo dos painéis de vidro: cabeçalho em faixa arredondada, linhas sem grade pesada. */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto px-3 pb-3">
      <table
        className={cn(
          "w-full border-separate border-spacing-0 text-left text-sm",
          "[&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-medium [&_th]:text-zinc-500",
          "[&_thead_th]:bg-white/50 [&_thead_th:first-child]:rounded-l-2xl [&_thead_th:last-child]:rounded-r-2xl",
          "[&_tbody_td]:border-b [&_tbody_td]:border-zinc-100 [&_tbody_tr:last-child_td]:border-b-0",
          "[&_tbody_td]:transition-colors [&_tbody_tr:hover_td]:bg-white/45 [&_tbody_tr:hover_td:first-child]:rounded-l-2xl [&_tbody_tr:hover_td:last-child]:rounded-r-2xl",
        )}
      >
        {children}
      </table>
    </div>
  );
}

/** Iniciais em círculo (clientes, usuário logado). */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-white/80 text-xs font-semibold text-zinc-700 shadow-sm ring-1 ring-white", className)}>{initials}</span>
  );
}
