import { Armchair, CircleDot, Cog, Gauge, Info, Lightbulb, Package, type LucideIcon } from "lucide-react";
import type { HotspotKind } from "@/lib/types";

// Tipos de ponto interativo do showroom: ícone, nome padrão e dica para o vendedor.
export const HOTSPOT_META: Record<HotspotKind, { icon: LucideIcon; label: string; hint: string }> = {
  engine: { icon: Cog, label: "Motor", hint: "Clique sobre o capô · fotos do motor" },
  wheels: { icon: CircleDot, label: "Rodas e pneus", hint: "Clique sobre uma roda · pneus, rodas e conservação" },
  interior: { icon: Armchair, label: "Interior", hint: "Clique no vidro lateral · bancos, volante e acabamento" },
  trunk: { icon: Package, label: "Porta-malas", hint: "Clique na tampa traseira · espaço interno" },
  dashboard: { icon: Gauge, label: "Painel", hint: "Clique no para-brisa · quilometragem e instrumentos" },
  lights: { icon: Lightbulb, label: "Faróis e lanternas", hint: "Clique sobre uma lanterna · iluminação e acabamento" },
  custom: { icon: Info, label: "Detalhe", hint: "Qualquer outro detalhe que valha mostrar" },
};
