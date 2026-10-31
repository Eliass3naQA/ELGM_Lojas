import { DomainError, getStoreBySlug, listCustomers } from "@/lib/data/repository";
import { date } from "@/lib/format";
import { handle } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string }> };

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  // evita injeção de fórmulas ao abrir no Excel
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// Exporta a base de clientes (CSV separado por ";" para abrir direto no Excel BR).
// TODO(auth): exigir dono da loja.
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const store = await getStoreBySlug((await params).slug);
  if (!store) throw new DomainError("Loja não encontrada.", 404);
  const onlyMarketing = new URL(req.url).searchParams.get("marketing") === "1";
  const customers = (await listCustomers(store.id)).filter((c) => !onlyMarketing || c.marketingOptIn);
  const header = ["Nome", "E-mail", "Login", "CPF", "Telefone", "Nascimento", "CEP", "Endereço", "Bairro", "Cidade", "UF", "Aceitou termos em", "Aceita marketing", "Pedidos", "Total gasto"];
  const rows = customers.map((c) => [
    c.name, c.email, c.provider ?? "", c.cpf ?? "", c.phone, c.birthDate ?? "",
    c.address?.cep ?? "", c.address ? `${c.address.street}, ${c.address.number} ${c.address.complement}`.trim() : "",
    c.address?.district ?? "", c.address?.city ?? c.city, c.address?.state ?? "",
    c.acceptedTermsAt ? date(c.acceptedTermsAt) : "", c.marketingOptIn ? "sim" : "não", c.orders, c.spent.toFixed(2).replace(".", ","),
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="clientes-${store.slug}.csv"` },
  });
});
