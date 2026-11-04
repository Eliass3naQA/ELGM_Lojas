// Organiza o que o lojista cadastrou (ficha livre + descrição) para a página do produto.
// Só reordena dados existentes: nada aqui inventa garantia, quilometragem ou histórico.
import type { Product, Spec } from "./types";

export type SpecKind = "km" | "fuel" | "gearbox" | "engine" | "power" | "torque" | "drive" | "doors" | "seats" | "trunk" | "year" | "color" | "warranty" | "service" | "origin" | "report" | "other";

const KINDS: [RegExp, SpecKind][] = [
  [/quilomet|kilomet|\bkm\b/i, "km"],
  [/combust/i, "fuel"],
  [/c[âa]mbio|transmiss/i, "gearbox"],
  [/motor/i, "engine"],
  [/pot[êe]ncia/i, "power"],
  [/torque/i, "torque"],
  [/tra[çc][ãa]o/i, "drive"],
  [/portas/i, "doors"],
  [/lugares/i, "seats"],
  [/porta-?malas/i, "trunk"],
  [/\bano\b/i, "year"],
  [/\bcor\b/i, "color"],
  [/garantia/i, "warranty"],
  [/revis/i, "service"],
  [/proced/i, "origin"],
  [/laudo|vistoria/i, "report"],
];

export const specKind = (label: string): SpecKind => KINDS.find(([re]) => re.test(label))?.[1] ?? "other";

const HIGHLIGHT_ORDER: SpecKind[] = ["km", "fuel", "gearbox", "power"];
const TRUST_KINDS: SpecKind[] = ["warranty", "service", "origin", "report"];

/** Separa os "Itens de série" que o cadastro inteligente grava no fim da descrição. */
function splitEquipment(description: string) {
  const match = description.match(/(?:^|\n)\s*itens de s[ée]rie:?\s*\n([\s\S]*)$/i);
  if (!match) return { text: description.trim(), equipment: [] as string[] };
  const equipment = match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*[•\-*]\s*/, "").trim())
    .filter(Boolean);
  return { text: description.slice(0, match.index).trim(), equipment };
}

export interface ProductFacts {
  title: string; // nome sem o ano, que vai para o subtítulo
  year: string | null;
  highlights: Spec[];
  details: Spec[];
  trust: Spec[];
  equipment: string[];
  text: string;
}

export function productFacts(product: Pick<Product, "name" | "specs" | "description">, vehicle: boolean): ProductFacts {
  const { text, equipment } = splitEquipment(product.description);
  const year = product.specs.find((s) => specKind(s.label) === "year")?.value.trim() || null;
  const title = year ? product.name.replace(new RegExp(`\\s*\\b${year.replace(/\D/g, "")}\\b\\s*$`), "").trim() || product.name : product.name;

  if (!vehicle) {
    return { title: product.name, year: null, highlights: product.specs.slice(0, 3), details: product.specs.slice(3), trust: [], equipment, text };
  }

  const highlights = HIGHLIGHT_ORDER.flatMap((kind) => product.specs.filter((s) => specKind(s.label) === kind)).slice(0, 3);
  const trust = product.specs.filter((s) => TRUST_KINDS.includes(specKind(s.label)));
  const details = product.specs.filter((s) => !highlights.includes(s) && !trust.includes(s) && specKind(s.label) !== "year");
  return { title, year, highlights, details, trust, equipment, text };
}
