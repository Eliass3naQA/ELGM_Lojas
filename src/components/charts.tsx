"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactNumber, money } from "@/lib/format";

type Point = { label: string; revenue: number; orders: number };

// tooltip em vidro, igual aos cards
const tooltipStyle = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,.8)",
  background: "rgba(255,255,255,.85)",
  backdropFilter: "blur(20px)",
  fontSize: 12,
  boxShadow: "0 12px 32px -12px rgba(0,0,0,.25)",
  padding: "8px 12px",
};
const axisTick = { fontSize: 11, fill: "#71717a" };

/** Faturamento por dia (uma série; pedidos aparecem no tooltip, sem segundo eixo). */
export function RevenueChart({ data, color = "#6366f1" }: { data: Point[]; color?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, ""); // o id vira url(#...) no SVG
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={`rev${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(24,24,27,.07)" strokeDasharray="3 5" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} interval="preserveStartEnd" minTickGap={28} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(v) => compactNumber(v)} width={48} />
          <Tooltip
            cursor={{ stroke: "rgba(24,24,27,.25)", strokeDasharray: "4 4" }}
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#71717a", marginBottom: 2 }}
            formatter={(v, _name, item) => [`${money(Number(v))} · ${(item.payload as Point).orders} pedido(s)`, "Faturamento"]}
          />
          <Area type="monotone" dataKey="revenue" stroke={color} strokeWidth={2} fill={`url(#rev${id})`} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: color }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ranking em trilhos (uma série, cor da marca). Valor exato ao lado de cada barra. */
export function HorizontalBars({ data }: { data: { name: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-3.5">
      {data.map((d) => (
        <li key={d.name} title={`${d.name}: ${money(d.value)}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-zinc-700">{d.name}</span>
            <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-900">{money(d.value)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-900/[0.07]">
            <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.max(3, (d.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// paleta categórica validada (CVD) — atribuída em ordem fixa, nunca reciclada por ranking
const PALETTE = ["#5B4FD6", "#E8643A", "#1E9E86", "#D4951C", "#C2417A"];

export function Donut({ data, centerLabel }: { data: { name: string; value: number }[]; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    // a legenda desce para baixo do anel quando o card é estreito
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={52} outerRadius={76} paddingAngle={3} cornerRadius={6} stroke="rgba(255,255,255,.9)" strokeWidth={2} startAngle={90} endAngle={-270}>
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [`${v} (${share(Number(v))}%)`, String(name)]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-semibold leading-none tracking-tight text-zinc-900">{total}</p>
            {centerLabel && <p className="mt-1 text-[11px] text-zinc-500">{centerLabel}</p>}
          </div>
        </div>
      </div>
      <ul className="min-w-[200px] flex-1 space-y-3 text-sm">
        {data.map((d, i) => (
          <li key={d.name}>
            <div className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="truncate text-zinc-700">{d.name}</span>
              <span className="ml-auto pl-3 text-xs font-medium tabular-nums text-zinc-900">{share(d.value)}%</span>
            </div>
            <div className="ml-[18px] mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-900/[0.07]">
              <div className="h-full rounded-full" style={{ width: `${share(d.value)}%`, background: PALETTE[i % PALETTE.length] }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
