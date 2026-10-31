// Modelos padrão de Termos de Uso e Política de Privacidade (LGPD).
// O lojista pode substituir os termos pelo próprio texto em Configurações.
// ⚠️ São modelos de partida: o lojista deve revisá-los com assessoria jurídica.

import type { Store } from "./types";

export type LegalSection = { title: string; body: string };

export function defaultTerms(store: Store): LegalSection[] {
  return [
    { title: "1. Aceitação", body: `Ao criar uma conta ou comprar na ${store.name}, você concorda com estes Termos de Uso e com a nossa Política de Privacidade.` },
    { title: "2. Cadastro", body: "Você é responsável pela veracidade dos dados informados (nome, CPF, telefone e endereço) e por manter o acesso à sua conta de login (Google, Microsoft ou Apple) em segurança." },
    { title: "3. Pedidos e preços", body: "Os preços e a disponibilidade podem mudar sem aviso prévio. O pedido só é confirmado após a aprovação do pagamento. Em caso de erro evidente de preço, a loja pode cancelar o pedido e devolver integralmente o valor pago." },
    { title: "4. Pagamento", body: "Pagamentos via Pix ou boleto são confirmados após a análise do comprovante enviado. Comprovantes inválidos ou divergentes do valor do pedido serão recusados." },
    { title: "5. Entrega", body: "O prazo de entrega começa a contar após a aprovação do pagamento. O código de rastreio é disponibilizado na página do pedido assim que o produto for enviado." },
    { title: "6. Trocas e devoluções", body: "Conforme o Código de Defesa do Consumidor (art. 49), você pode desistir da compra em até 7 dias corridos após o recebimento. Trocas por defeito seguem os prazos legais de garantia." },
    { title: "7. Contato", body: `Dúvidas sobre pedidos: ${store.ownerEmail}.` },
  ];
}

export function privacyPolicy(store: Store): LegalSection[] {
  return [
    { title: "Quem é o controlador", body: `${store.name} é a controladora dos seus dados pessoais, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018). A plataforma LojaFlow atua como operadora.` },
    { title: "Quais dados coletamos", body: "Nome, e-mail e provedor de login; CPF, telefone, data de nascimento e endereço de entrega informados no cadastro; histórico de pedidos e comprovantes de pagamento." },
    { title: "Para que usamos", body: "Para processar e entregar seus pedidos, emitir documentos fiscais, prevenir fraudes, prestar atendimento e — somente se você autorizar — enviar ofertas e novidades." },
    { title: "Com quem compartilhamos", body: "Apenas com transportadoras, meios de pagamento e órgãos públicos quando exigido por lei. Não vendemos seus dados." },
    { title: "Por quanto tempo guardamos", body: "Pelo tempo necessário para cumprir as finalidades acima e as obrigações legais e fiscais (em regra, 5 anos após a última compra)." },
    { title: "Seus direitos", body: `Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados e revogar o consentimento de marketing a qualquer momento, pela sua conta ou pelo e-mail ${store.ownerEmail}.` },
  ];
}

/** Converte o texto livre do lojista em seções (parágrafos separados por linha em branco). */
export function parseCustomTerms(text: string): LegalSection[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [first, ...rest] = block.split("\n");
      return rest.length ? { title: first, body: rest.join("\n") } : { title: "", body: first };
    });
}

export const termsFor = (store: Store) => (store.customTerms ? parseCustomTerms(store.customTerms) : defaultTerms(store));
