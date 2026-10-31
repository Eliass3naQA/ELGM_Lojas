import { NewStoreForm } from "@/components/backoffice/new-store-form";
import { PageHeader } from "@/components/ui";
import { listPlans } from "@/lib/data/repository";

export const metadata = { title: "Nova loja" };

export default async function NewStorePage() {
  return (
    <>
      <PageHeader title="Nova loja" description="Cria o tenant, a vitrine e o painel do dono." />
      <NewStoreForm plans={await listPlans()} />
    </>
  );
}
