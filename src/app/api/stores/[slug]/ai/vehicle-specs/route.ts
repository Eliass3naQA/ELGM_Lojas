import { z } from "zod";
import { suggestVehicleSpecs } from "@/lib/ai/vehicle-specs";
import { DomainError, getStoreBySlug } from "@/lib/data/repository";
import { handle } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string }> };

const schema = z.object({
  model: z.string().trim().min(2, "Informe o modelo").max(80),
  year: z.number().int().min(1950, "Ano inválido").max(new Date().getFullYear() + 1, "Ano inválido"),
});

// Cada consulta custa tokens: limita por loja enquanto o painel não tem login.
// TODO(auth): exigir o dono da loja.
const WINDOW = 60 * 60 * 1000;
const LIMIT = 40;
const g = globalThis as unknown as { __aiCalls?: Map<string, number[]> };
const calls = (g.__aiCalls ??= new Map());

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) throw new DomainError("Loja não encontrada.", 404);
  const now = Date.now();
  const recent = (calls.get(store.id) ?? []).filter((t: number) => now - t < WINDOW);
  if (recent.length >= LIMIT) throw new DomainError("Limite de consultas à IA atingido. Tente de novo mais tarde.", 429);
  calls.set(store.id, [...recent, now]);
  return suggestVehicleSpecs(schema.parse(await req.json()));
});
