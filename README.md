# LojaFlow — SaaS multi-loja

Plataforma web para lojas online com três visões:

| Visão | Rota | Para quem |
|---|---|---|
| Vitrine | `/{loja}/home` | Compradores (cliente final) |
| Painel da loja | `/{loja}/painel` | Dono da loja |
| Backoffice | `/backoffice` | Dono da plataforma |

## Rodando

1. No SQL Editor do Supabase, rode `supabase/schema.sql` (tabelas, RLS, buckets e funções de checkout/estoque).
2. Copie `.env.example` para `.env.local` e preencha com os dados de *Project Settings → API*.
3. Instale e popule:

```bash
npm install
npm run db:seed    # dados de demonstração (só roda com o banco vazio)
npm run dev        # http://localhost:3000
```

Lojas de demonstração: `aurora-moda`, `cafe-do-ze`, `techlab`, `verde-vivo` (trial), `bike-urbana` (suspensa).
Ex.: http://localhost:3000/aurora-moda/home e http://localhost:3000/aurora-moda/painel

> Os dados ficam no **Supabase** (Postgres + Storage). O backend usa a service role; nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no navegador.

## Stack

- **Next.js 15 (App Router) + React 19 + TypeScript**: front e backend (API Routes) no mesmo projeto
- **Tailwind CSS 4**: tema por loja via variável CSS `--brand`
- **Zod**: validação das entradas da API
- **Recharts**: gráficos · **lucide-react**: ícones

## Rotas

**Vitrine** `/{loja}/…`: `home` (busca + categorias), `produto/{id}`, `entrar` (Google / Microsoft / Apple), `cadastro` (CPF, endereço com CEP automático, aceite dos termos), `carrinho` (checkout Pix/boleto), `pedido/{id}` (pagamento + comprovante + rastreio), `conta` (meus dados e pedidos), `termos`, `privacidade`

**Painel** `/{loja}/painel/…`: visão geral (KPIs, gráfico, insights), `pedidos` (analisar comprovante, enviar com rastreio, entregar, cancelar), `produtos` (fotos, variações, promoção, SKU; busca, filtros, ações em massa, duplicar), `estoque` (por variação, entradas/saídas/contagem, histórico), `promocoes` (preços promocionais e cupons), `clientes` (cadastro completo, consentimentos LGPD, segmentação, exportação CSV), `configuracoes` (logo, foto de capa, sobre, WhatsApp, Instagram, cor, frete, chave Pix, termos próprios)

**Backoffice** `/backoffice/…`: visão geral (GMV, MRR, taxas, ranking), `lojas` (criar, trocar plano, suspender/reativar), `pedidos` (todas as lojas), `planos` (receita por plano), `auditoria`

**API** `/api/…`
```
GET  POST         /api/stores
GET  PATCH        /api/stores/{slug}
GET  POST         /api/stores/{slug}/products
PUT  PATCH DELETE /api/stores/{slug}/products/{id}       (PUT = formulário completo · PATCH = ativo/preço/promo)
POST              /api/stores/{slug}/products/{id}/duplicate
POST              /api/stores/{slug}/products/bulk        (activate | deactivate | delete)
GET  POST         /api/stores/{slug}/stock                (histórico · entrada/saída/contagem)
GET  POST         /api/stores/{slug}/coupons
     PATCH DELETE /api/stores/{slug}/coupons/{id}
POST              /api/stores/{slug}/coupons/check        (vitrine valida o cupom)
POST              /api/stores/{slug}/uploads              (fotos; tipo conferido pelos bytes)
GET  POST         /api/stores/{slug}/orders          (POST = checkout)
     PATCH        /api/stores/{slug}/orders/{id}     (status / rastreio)
POST              /api/stores/{slug}/orders/{id}/receipt   (comprador envia comprovante, multipart)
GET               /api/stores/{slug}/orders/{id}/receipt   (ver comprovante)
POST              /api/stores/{slug}/orders/{id}/review    (lojista aprova/recusa)
GET  PUT          /api/stores/{slug}/me                    (perfil do comprador logado)
GET               /api/stores/{slug}/customers/export      (CSV; ?marketing=1 = só quem autorizou)
POST              /api/auth/mock-oauth · /api/auth/logout
GET               /api/backoffice/metrics
GET               /api/plans
```

## Catálogo, estoque e promoções

- **Variações**: até 3 por produto (ex.: Tamanho × Cor). Cada combinação tem SKU, estoque e preço próprios (opcional). O formulário sugere variações conforme o segmento da loja (`lib/catalog-templates.ts`): moda → tamanho/cor/numeração, alimentos → peso/moagem/sabor, eletrônicos → voltagem/cor/armazenamento…
- **Sem controle de estoque**: para produtos sob encomenda, serviços ou digitais.
- **Estoque**: toda venda, cancelamento, entrada, perda ou contagem gera uma movimentação com saldo, motivo e autor. Alerta de estoque baixo configurável por produto.
- **Promoções**: preço promocional com início/fim opcionais (variações com preço próprio recebem o mesmo % de desconto). Cupons de %, valor fixo ou frete grátis, com pedido mínimo, validade e limite de usos — sempre recalculados no servidor.
- **Fotos**: até 10 por produto (a 1ª é a principal; a 2ª aparece ao passar o mouse na vitrine), logo e capa da loja. Só JPG/PNG/WEBP, conferidos pelo conteúdo do arquivo.

## Showroom digital (veículos)

- **Showroom 360°** (`components/store/showroom.tsx`): a partir das fotos de cada ângulo (frente, traseira, laterais, diagonais opcionais, cima e baixo) o sistema monta um giro contínuo. Mouse ou toque para girar, pinça / Ctrl + roda / duplo clique para zoom, arrastar com zoom para explorar detalhes, tela cheia. Chegada animada com os faróis piscando (o vendedor marca os faróis na foto da frente).
- **Pontos interativos**: o vendedor clica sobre o veículo (capô, roda, vidro, porta-malas…) e anexa fotos reais do detalhe; o comprador clica no ponto e abre a galeria daquele detalhe.
- **Estúdio fotográfico** (`lib/studio/`): a IA de recorte roda **no navegador do vendedor** (BiRefNet lite, licença MIT, via transformers.js — WebGPU quando a placa suporta, senão WASM). O modelo (~115–224 MB) é baixado na primeira vez e fica guardado no navegador. Cada foto gera: original, recorte, imagem do showroom (fundo transparente, enquadramento padronizado) e foto de catálogo 1:1 no cenário escolhido (preto, bege, branco, cor da loja, logo). Trocar o cenário reaproveita os recortes.
- **Cadastro inteligente** (`lib/ai/vehicle-specs.ts`): em lojas de veículos, o vendedor informa modelo + ano e o Claude sugere nome, categoria, ficha técnica e descrição para revisão. Requer `ANTHROPIC_API_KEY` no servidor; limite de 40 consultas/hora por loja.

## Login e pagamento (simulados)

**Login** — `/{loja}/entrar` simula o OAuth: aceita só e-mails do provedor escolhido (Google: gmail · Microsoft: hotmail/outlook/live · Apple: icloud/me/mac). A sessão é um cookie httpOnly assinado (HMAC). Defina `SESSION_SECRET` em produção.

**Fluxo de compra**
1. Cliente entra → completa o cadastro (CPF validado, endereço, aceite dos Termos/Privacidade, opt-in de marketing opcional)
2. Fecha o pedido → recebe **Pix (QR Code + copia e cola no padrão BR Code)** ou boleto (simulado)
3. Paga e envia o **comprovante** (JPG/PNG/WEBP/PDF, até 5 MB)
4. Lojista vê em *Pedidos → Comprovantes p/ analisar* → **aprova** (libera o envio) ou **recusa com motivo** (cliente reenvia)
5. Lojista informa o rastreio → enviado → entregue

Se o lojista alterar os termos, os clientes precisam aceitar de novo antes da próxima compra.

## Arquitetura

```
src/
  app/                 páginas e API (rotas acima)
  components/          UI, gráficos, sidebar, vitrine, painel, backoffice
  lib/
    types.ts           modelos de domínio
    data/repository.ts ← ÚNICO ponto de acesso a dados (Supabase)
    data/supabase.ts   client do servidor (service role)
    data/seed.ts       dados de exemplo (usados por scripts/seed.ts)
    insights.ts        motor de insights (regras de negócio)
    auth/              sessão (cookie assinado) e provedores de login
    payments/          provider.ts (interface + modo manual) e pix.ts (BR Code)
    legal.ts           modelos de Termos de Uso e Política de Privacidade (LGPD)
    validation.ts      schemas Zod + tratamento de erros da API
supabase/schema.sql    tabelas, enums, RLS, buckets e funções SQL (create_order, cancel_order, adjust_stock)
scripts/seed.ts        npm run db:seed
```

Regras de negócio no backend: estoque validado e baixado no checkout (e devolvido ao cancelar), frete grátis por valor mínimo, transições de status controladas (`pending → paid → shipped → delivered`), envio exige rastreio, limite de produtos por plano, slugs reservados, loja suspensa não vende.

## Supabase

Já conectado: dados no Postgres, fotos no bucket público `media` e comprovantes no bucket privado `receipts`. Checkout, cancelamento e ajuste de estoque são funções SQL transacionais (`select ... for update`), sem risco de vender acima do estoque.

Próximos passos:

1. Auth do comprador: habilite Google, Azure (Microsoft) e Apple em *Authentication → Providers*; troque `LoginPanel` por `supabase.auth.signInWithOAuth()` e `lib/auth/session.ts` pela sessão do Supabase.
2. Auth do lojista/backoffice: os pontos `TODO(auth)` indicam onde proteger o painel (dono da loja) e o backoffice (`platform_admins`). **Hoje o painel e o backoffice estão abertos.**

## Mercado Pago (próximo passo)

Implemente um `mercadopagoProvider` em `src/lib/payments/provider.ts` com a mesma interface do `manualProvider`:
- `getInstructions` cria o pagamento no MP e devolve o QR Pix / link do cartão;
- uma rota `/api/webhooks/mercadopago` valida a assinatura e chama `reviewPayment(..., { approve: true }, "mercadopago")`;
- o campo `externalId` do `Payment` guarda o id do MP. O modo manual pode continuar como alternativa.
