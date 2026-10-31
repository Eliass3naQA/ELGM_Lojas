import type { BadgeTone } from "@/components/ui";
import type { CustomerWithStats } from "./data/repository";

const DAY = 86_400_000;

// Segmentação simples (RFM light) para orientar ações de marketing.
export function segment(c: CustomerWithStats, vipThreshold: number): { label: string; tone: BadgeTone } {
  if (c.orders === 0) return { label: "Sem compras", tone: "zinc" };
  const idle = c.lastOrderAt ? (Date.now() - new Date(c.lastOrderAt).getTime()) / DAY : Infinity;
  if (c.spent >= vipThreshold && c.orders >= 2) return idle > 30 ? { label: "VIP adormecido", tone: "yellow" } : { label: "VIP", tone: "violet" };
  if (idle > 45) return { label: "Inativo", tone: "red" };
  if (c.orders === 1) return { label: "Novo", tone: "blue" };
  return { label: "Recorrente", tone: "green" };
}

/** Top 20% em gasto = VIP. */
export function vipThreshold(customers: CustomerWithStats[]) {
  const buyers = customers.filter((c) => c.orders > 0).sort((a, b) => b.spent - a.spent);
  return buyers.length ? buyers[Math.max(0, Math.floor(buyers.length * 0.2) - 1)].spent : Infinity;
}
