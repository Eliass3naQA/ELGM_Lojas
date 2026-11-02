// Ficha técnica sugerida por IA (Claude) a partir de modelo + ano.
// Só roda no servidor: a chave ANTHROPIC_API_KEY nunca vai para o navegador.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { DomainError } from "../data/repository";
import type { Spec } from "../types";

export const VEHICLE_CATEGORIES = ["SUVs", "Sedãs", "Hatches", "Picapes", "Utilitários", "Esportivos", "Motos", "Outros"] as const;

const nullableText = z.string().nullable();

// Formato que o modelo é obrigado a devolver (structured outputs).
const VehicleSpecsSchema = z.object({
  reconhecido: z.boolean().describe("true se o modelo/ano existe no mercado brasileiro e foi reconhecido"),
  nome: z.string().describe('Nome comercial completo para o anúncio, ex.: "Volkswagen Taos Highline 250 TSI 2023"'),
  categoria: z.enum(VEHICLE_CATEGORIES),
  motor: nullableText,
  potencia: nullableText,
  torque: nullableText,
  cambio: nullableText,
  combustivel: nullableText,
  tracao: nullableText,
  portas: nullableText,
  lugares: nullableText,
  portaMalas: nullableText,
  equipamentos: z.array(z.string()).describe("Itens de série desta versão/ano"),
  descricao: z.string().describe("2 a 3 parágrafos curtos de apresentação para o anúncio"),
  observacao: nullableText.describe("Avisos para o vendedor revisar (ex.: versão ambígua, dado incerto)"),
});

const SYSTEM = `Você é especialista no mercado automotivo brasileiro e ajuda vendedores de uma loja de seminovos a cadastrar veículos.
Dado um modelo (com versão, quando houver) e o ano, devolva a ficha técnica de fábrica padronizada daquela versão no Brasil.
- Use o padrão brasileiro: potência em cv (indique etanol/gasolina quando diferirem), torque em kgfm, porta-malas em litros, combustível como "Flex", "Gasolina", "Diesel", "Elétrico" ou "Híbrido".
- Se não tiver segurança sobre um campo, devolva null nesse campo em vez de chutar, e explique em "observacao".
- Se a versão não foi informada e o modelo tem versões muito diferentes, use a mais comum e avise em "observacao".
- "equipamentos" lista apenas itens de série daquela versão e ano (até 15, os mais relevantes para o comprador).
- "descricao" é um texto de anúncio honesto e elegante, em português do Brasil, sem inventar estado de conservação, quilometragem ou histórico do carro anunciado.
- Se o veículo não existir ou não for reconhecido, marque "reconhecido": false.`;

export interface VehicleSuggestion {
  name: string;
  category: (typeof VEHICLE_CATEGORIES)[number];
  specs: Spec[];
  equipment: string[];
  description: string;
  note: string | null;
}

let client: Anthropic | null = null;

export async function suggestVehicleSpecs(input: { model: string; year: number }): Promise<VehicleSuggestion> {
  if (!process.env.ANTHROPIC_API_KEY) throw new DomainError("Preenchimento com IA indisponível: configure ANTHROPIC_API_KEY no servidor.", 503);
  client ??= new Anthropic();

  let response;
  try {
    response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // pesquisa de conhecimento simples: pouco raciocínio basta e reduz o custo
      output_config: { effort: "low", format: betaZodOutputFormat(VehicleSpecsSchema) },
      // se o modelo recusar por política, a API refaz o pedido num modelo alternativo
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: `Modelo: ${input.model}\nAno: ${input.year}` }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new DomainError("Chave da IA inválida. Verifique ANTHROPIC_API_KEY.", 503);
    if (e instanceof Anthropic.RateLimitError) throw new DomainError("A IA está sobrecarregada. Tente de novo em instantes.", 429);
    if (e instanceof Anthropic.APIConnectionError) throw new DomainError("Não foi possível falar com a IA. Verifique a conexão.", 502);
    if (e instanceof Anthropic.APIError) throw new DomainError(`A IA retornou um erro (${e.status}). Tente de novo.`, 502);
    throw e;
  }

  if (response.stop_reason === "refusal") throw new DomainError("A IA não conseguiu responder a este pedido. Preencha manualmente.", 422);
  const data = response.parsed_output;
  if (!data) throw new DomainError("A IA devolveu uma resposta incompleta. Tente de novo.", 502);
  if (!data.reconhecido) throw new DomainError(`Não reconheci "${input.model} ${input.year}". Confira o nome do modelo e a versão.`, 422);

  const rows: [string, string | null][] = [
    ["Ano", String(input.year)],
    ["Motor", data.motor],
    ["Potência", data.potencia],
    ["Torque", data.torque],
    ["Câmbio", data.cambio],
    ["Combustível", data.combustivel],
    ["Tração", data.tracao],
    ["Portas", data.portas],
    ["Lugares", data.lugares],
    ["Porta-malas", data.portaMalas],
  ];
  return {
    name: data.nome.trim().slice(0, 120),
    category: data.categoria,
    specs: rows.filter((r): r is [string, string] => !!r[1]?.trim()).map(([label, value]) => ({ label, value: value.trim().slice(0, 120) })),
    equipment: data.equipamentos.map((e) => e.trim()).filter(Boolean).slice(0, 15),
    description: data.descricao.trim(),
    note: data.observacao?.trim() || null,
  };
}
