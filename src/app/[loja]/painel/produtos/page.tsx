import { Plus } from "lucide-react";
import { ProductsTable } from "@/components/painel/products-table";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { loadStore } from "@/lib/data/load-store";
import { getPlan, listProducts } from "@/lib/data/repository";

export const metadata = { title: "Produtos" };

export default async function ProductsPage({ params }: { params: Promise<{ loja: string }> }) {
  const { loja } = await params;
  const store = await loadStore(loja);
  const [products, plan] = await Promise.all([listProducts(store.id, { includeInactive: true }), getPlan(store.planId)]);
  const base = `/${loja}/painel/produtos`;

  return (
    <>
      <PageHeader
        title="Produtos"
        description={`${products.length}${plan.maxProducts ? ` de ${plan.maxProducts}` : ""} produtos · plano ${plan.name}`}
        action={
          <ButtonLink href={`${base}/novo`}>
            <Plus className="size-4" /> Novo produto
          </ButtonLink>
        }
      />
      {products.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum produto ainda" description="Cadastre o primeiro produto da sua loja." action={<ButtonLink href={`${base}/novo`}>Criar produto</ButtonLink>} />
        </Card>
      ) : (
        // `now` vem do servidor para que promoções agendadas apareçam iguais no SSR e no navegador
        <ProductsTable slug={loja} products={products} now={Date.now()} />
      )}
    </>
  );
}
