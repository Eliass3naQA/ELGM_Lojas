// Insights automáticos gerados a partir dos dados.
// Hoje são heurísticas determinísticas; o formato (Insight[]) já serve para
// enriquecer depois com um LLM (ex.: resumo semanal escrito pela IA).

import { getPlan, listCustomers, listOrders, listPayments, listProducts, listStores, platformMetrics, storeMetrics } from "./data/repository";
import { money, pct } from "./format";
import { promoActive, variantLabel } from "./pricing";
import type { Insight, Store } from "./types";

const DAY = 86_400_000;

export async function storeInsights(store: Store): Promise<Insight[]> {
  const base = `/${store.slug}/painel`;
  const [m, products, orders, customers, plan, inReview] = await Promise.all([
    storeMetrics(store.id),
    listProducts(store.id, { includeInactive: true }),
    listOrders({ storeId: store.id }),
    listCustomers(store.id),
    getPlan(store.planId),
    listPayments({ storeId: store.id, status: "in_review" }),
  ]);
  const out: Insight[] = [];

  if (inReview.length) {
    const oldestHours = Math.max(...inReview.map((p) => (Date.now() - new Date(p.submittedAt!).getTime()) / 3_600_000));
    out.push({
      level: oldestHours >= 24 ? "danger" : "warning",
      title: `${inReview.length} comprovante(s) aguardando sua análise`,
      detail:
        oldestHours >= 24
          ? `O mais antigo espera há ${Math.floor(oldestHours / 24)} dia(s). Clientes sem resposta tendem a cancelar.`
          : "Confira os pagamentos para liberar o envio.",
      href: `${base}/pedidos?status=review`,
    });
  }

  const toShip = orders.filter((o) => o.status === "paid");
  if (toShip.length) {
    const oldest = Math.floor((Date.now() - new Date(toShip.at(-1)!.createdAt).getTime()) / DAY);
    out.push({
      level: oldest >= 2 ? "danger" : "warning",
      title: `${toShip.length} pedido(s) pago(s) aguardando envio`,
      detail: oldest >= 2 ? `O mais antigo está parado há ${oldest} dias. Atrasos derrubam a recompra.` : "Envie hoje para manter seu prazo em dia.",
      href: `${base}/pedidos?status=paid`,
    });
  }

  // estoque por SKU (produto sem variação, ou cada variação), respeitando o mínimo de cada produto
  const skus = products
    .filter((p) => p.active && p.trackStock)
    .flatMap((p) => (p.variants.length ? p.variants.map((v) => ({ p, label: `${p.name} ${variantLabel(v)}`, stock: v.stock })) : [{ p, label: p.name, stock: p.stock }]));
  const out0 = skus.filter((x) => x.stock === 0);
  const low = skus.filter((x) => x.stock > 0 && x.stock <= x.p.lowStockThreshold);
  const topIds = new Set(m.topProducts.map((t) => t.id));
  const criticalLow = [...out0, ...low].filter((x) => topIds.has(x.p.id));
  const list = (xs: typeof skus) => xs.slice(0, 4).map((x) => `${x.label} (${x.stock})`).join(", ") + (xs.length > 4 ? ` e mais ${xs.length - 4}` : "");
  if (criticalLow.length)
    out.push({ level: "danger", title: "Best-sellers acabando", detail: `${list(criticalLow)} — reponha antes de perder vendas.`, href: `${base}/estoque` });
  if (out0.length) out.push({ level: "warning", title: `${out0.length} item(ns) esgotado(s)`, detail: list(out0), href: `${base}/estoque` });
  if (low.length) out.push({ level: "info", title: `${low.length} item(ns) com estoque baixo`, detail: list(low), href: `${base}/estoque` });

  const now = Date.now();
  const ending = products.filter((p) => promoActive(p.promo, now) && p.promo.endsAt && new Date(p.promo.endsAt).getTime() - now < 3 * DAY);
  if (ending.length)
    out.push({ level: "info", title: `${ending.length} promoção(ões) terminando em até 3 dias`, detail: ending.map((p) => p.name).join(", ") + ". Prorrogue ou avise seus clientes.", href: `${base}/promocoes` });
  const noPhotos = products.filter((p) => p.active && p.images.length === 0).length;
  if (noPhotos && noPhotos >= products.length / 2)
    out.push({ level: "info", title: `${noPhotos} produto(s) sem foto`, detail: "Produtos com fotos reais vendem bem mais. Adicione pelo menos uma foto em cada.", href: `${base}/produtos` });

  if (m.revenueGrowth >= 10)
    out.push({ level: "success", title: `Faturamento ${pct(m.revenueGrowth)} vs. período anterior`, detail: `Você vendeu ${money(m.revenue)} nos últimos 30 dias. Ótimo momento para aumentar o estoque dos campeões.` });
  else if (m.revenueGrowth <= -10)
    out.push({ level: "warning", title: `Faturamento caiu ${pct(m.revenueGrowth)}`, detail: "Considere uma campanha para clientes recorrentes ou um cupom de frete grátis." });

  if (m.topProducts[0]) {
    const t = m.topProducts[0];
    const share = m.revenue ? (t.revenue / m.revenue) * 100 : 0;
    out.push({ level: "info", title: `${t.image} ${t.name} é seu campeão`, detail: `${t.qty} unidades e ${share.toFixed(0)}% do faturamento. Destaque-o na vitrine.` });
  }

  if (store.freeShippingOver === null && m.avgTicket > 0) {
    const suggestion = Math.ceil((m.avgTicket * 1.2) / 10) * 10;
    out.push({
      level: "info",
      title: "Experimente frete grátis acima de um valor",
      detail: `Seu ticket médio é ${money(m.avgTicket)}. Frete grátis a partir de ${money(suggestion)} tende a aumentar o valor do carrinho.`,
      href: `${base}/configuracoes`,
    });
  }

  const sleepingVips = customers.filter((c) => c.orders >= 2 && c.lastOrderAt && Date.now() - new Date(c.lastOrderAt).getTime() > 30 * DAY);
  if (sleepingVips.length)
    out.push({ level: "info", title: `${sleepingVips.length} cliente(s) fiéis sem comprar há 30+ dias`, detail: "Uma mensagem personalizada pode trazê-los de volta.", href: `${base}/clientes` });

  if (plan.maxProducts && products.length >= plan.maxProducts * 0.8)
    out.push({ level: "warning", title: "Perto do limite do plano", detail: `${products.length}/${plan.maxProducts} produtos no plano ${plan.name}.` });

  return out;
}

export async function platformInsights(): Promise<Insight[]> {
  const [m, stores] = await Promise.all([platformMetrics(), listStores()]);
  const out: Insight[] = [];

  const trials = stores.filter((s) => s.status === "trial");
  if (trials.length)
    out.push({ level: "info", title: `${trials.length} loja(s) em trial`, detail: `${trials.map((s) => s.name).join(", ")} — acompanhe a ativação para converter.`, href: "/backoffice/lojas?status=trial" });

  const suspended = stores.filter((s) => s.status === "suspended");
  if (suspended.length) out.push({ level: "danger", title: `${suspended.length} loja(s) suspensa(s)`, detail: suspended.map((s) => s.name).join(", "), href: "/backoffice/lojas?status=suspended" });

  for (const row of m.perStore) {
    if (row.store.status !== "active") continue;
    if (row.growth <= -20)
      out.push({ level: "warning", title: `Risco de churn: ${row.store.name}`, detail: `GMV caiu ${pct(row.growth)} em 30 dias.`, href: `/backoffice/lojas/${row.store.slug}` });
    if (row.growth >= 30)
      out.push({ level: "success", title: `${row.store.name} em crescimento`, detail: `GMV ${pct(row.growth)} — ${money(row.gmv)} em 30 dias.`, href: `/backoffice/lojas/${row.store.slug}` });

    // Upgrade: se a economia na taxa pagaria a diferença de mensalidade, vale sugerir.
    const plan = await getPlan(row.store.planId);
    if (plan.id === "starter") {
      const pro = await getPlan("pro");
      const saving = (row.gmv * (plan.feePercent - pro.feePercent)) / 100;
      if (saving > pro.priceMonthly - plan.priceMonthly)
        out.push({ level: "success", title: `Oportunidade de upgrade: ${row.store.name}`, detail: `Economizaria ${money(saving)}/mês em taxas no plano Pro.`, href: `/backoffice/lojas/${row.store.slug}` });
    }
  }

  out.push({ level: "info", title: `Receita da plataforma: ${money(m.mrr + m.feeRevenue)}/mês`, detail: `${money(m.mrr)} de assinaturas + ${money(m.feeRevenue)} de taxas sobre ${money(m.gmv)} de GMV.` });
  return out;
}
