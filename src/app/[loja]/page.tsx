import { redirect } from "next/navigation";

export default async function StoreIndex({ params }: { params: Promise<{ loja: string }> }) {
  redirect(`/${(await params).loja}/home`);
}
