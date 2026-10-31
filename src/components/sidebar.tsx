"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  ScrollText,
  Search,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  Users,
  Warehouse,
} from "lucide-react";
import { Avatar, cn } from "./ui";

// Ícones referenciados por nome para que layouts (Server Components) possam passar a navegação.
const icons = { BarChart3, Boxes, ClipboardList, CreditCard, LayoutDashboard, ScrollText, Settings, ShoppingBag, Store, Tag, Users, Warehouse };
export type IconName = keyof typeof icons;
export type NavItem = { href: string; label: string; icon: IconName; badge?: number };

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Casca dos painéis (dono da loja e backoffice): menu lateral flutuante, barra superior e folha de vidro. */
export function AppShell({
  brand,
  subtitle,
  nav,
  footerLink,
  user,
  notifications,
  banner,
  children,
}: {
  brand: React.ReactNode;
  subtitle: string;
  nav: NavItem[];
  footerLink?: { href: string; label: string };
  user: { name: string; role: string };
  notifications?: { count: number; href: string; label: string };
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // o item mais específico que casa com a URL atual é o ativo
  const active = nav
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="min-h-screen">
      {/* menu lateral (desktop) */}
      <aside className="glass fixed inset-y-4 left-4 z-30 hidden w-[248px] flex-col rounded-[30px] lg:flex">
        <div className="px-5 pb-4 pt-6">
          {brand}
          <p className="mt-3 pl-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">{subtitle}</p>
        </div>
        <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-3">
          {nav.map((item) => {
            const Icon = icons[item.icon];
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                  isActive ? "bg-white/85 text-zinc-950 shadow-[0_6px_16px_-8px_rgb(0_0_0/0.25)]" : "text-zinc-600 hover:bg-white/45 hover:text-zinc-900",
                )}
              >
                <Icon className={cn("size-[18px] transition", isActive ? "text-zinc-900" : "text-zinc-500 group-hover:text-zinc-800")} />
                {item.label}
                {!!item.badge && <span className="ml-auto min-w-5 rounded-full bg-[var(--brand)] px-1.5 text-center text-[11px] font-semibold leading-5 text-white">{item.badge}</span>}
              </Link>
            );
          })}
        </nav>
        {footerLink && (
          <Link
            href={footerLink.href}
            target="_blank"
            className="mx-3 mb-3 flex items-center justify-between rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white shadow-[0_10px_24px_-12px_rgb(0_0_0/0.6)] transition hover:bg-zinc-800"
          >
            {footerLink.label} <ExternalLink className="size-4 opacity-70" />
          </Link>
        )}
      </aside>

      <div className="px-3 pb-28 pt-3 sm:px-4 lg:pb-6 lg:pl-[280px] lg:pt-4">
        <TopBar nav={nav} user={user} notifications={notifications} brand={brand} />
        {banner}
        <main className="glass-sheet mt-3 rounded-[32px] p-4 sm:p-6 lg:mt-4 lg:p-8">
          <div className="mx-auto max-w-[1240px]">{children}</div>
        </main>
      </div>

      {/* navegação inferior em pílula (mobile) */}
      <nav className="glass-strong no-scrollbar fixed inset-x-3 bottom-3 z-30 flex gap-1 overflow-x-auto rounded-full p-1.5 lg:hidden">
        {nav.map((item) => {
          const Icon = icons[item.icon];
          const isActive = item.href === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-medium transition",
                isActive ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-white/70",
              )}
            >
              <Icon className="size-[18px]" />
              {isActive && item.label}
              {!!item.badge && !isActive && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[var(--brand)] ring-2 ring-white" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function TopBar({ nav, user, notifications, brand }: { nav: NavItem[]; user: { name: string; role: string }; notifications?: { count: number; href: string; label: string }; brand: React.ReactNode }) {
  return (
    <header className="glass relative z-20 flex h-16 items-center gap-3 rounded-full pl-2.5 pr-2.5 sm:pl-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="lg:hidden [&_.brand-name]:hidden">{brand}</div>
        <Avatar name={user.name} className="hidden size-10 lg:grid" />
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-sm font-semibold text-zinc-900">Bem-vindo, {user.name.split(" ")[0]}</p>
          <p className="truncate text-xs text-zinc-500">{user.role}</p>
        </div>
      </div>
      <QuickJump nav={nav} />
      <div className="flex shrink-0 items-center gap-2">
        {notifications && (
          <Link href={notifications.href} aria-label={notifications.label} title={notifications.label} className="relative grid size-11 place-items-center rounded-full bg-white/85 text-zinc-700 shadow-sm transition hover:bg-white">
            <Bell className="size-[18px]" />
            {notifications.count > 0 && <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-red-500 ring-2 ring-white" />}
          </Link>
        )}
        <Avatar name={user.name} className="hidden size-11 sm:grid lg:hidden" />
      </div>
    </header>
  );
}

/** Busca rápida entre as seções do painel (atalho: Ctrl/⌘ + K). */
function QuickJump({ nav }: { nav: NavItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => nav.filter((n) => normalize(n.label).includes(normalize(q.trim()))), [nav, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (item?: NavItem) => {
    if (!item) return;
    router.push(item.href);
    setQ("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="flex h-11 items-center gap-2.5 rounded-full bg-white/55 pl-1.5 pr-3 ring-1 ring-white/70 transition focus-within:bg-white/85">
        <span className="orb size-8 shrink-0 rounded-full shadow-[0_0_16px_rgb(139_92_246/0.45)]" />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, matches.length - 1));
            else if (e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
            else if (e.key === "Enter") go(matches[cursor]);
            else if (e.key === "Escape") input.current?.blur();
          }}
          placeholder="Ir para… pedidos, estoque, clientes"
          aria-label="Ir para uma seção"
          className="min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-500"
        />
        <kbd className="hidden rounded-md bg-white/80 px-1.5 py-0.5 font-sans text-[10px] font-medium text-zinc-500 shadow-sm sm:block">Ctrl K</kbd>
        <Search className="size-4 text-zinc-400 sm:hidden" />
      </div>
      {open && matches.length > 0 && (
        <ul className="glass-strong animate-fade-up absolute inset-x-0 top-[calc(100%+8px)] overflow-hidden rounded-3xl p-1.5">
          {matches.map((m, i) => {
            const Icon = icons[m.icon];
            return (
              <li key={m.href}>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(m)}
                  onMouseEnter={() => setCursor(i)}
                  className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition", i === cursor ? "bg-zinc-950 text-white" : "text-zinc-700")}
                >
                  <Icon className="size-4 opacity-70" /> {m.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
