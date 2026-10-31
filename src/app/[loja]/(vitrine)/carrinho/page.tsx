import { Checkout, type CheckoutViewer } from "@/components/store/checkout";
import { getSessionUser } from "@/lib/auth/session";
import { loadStore } from "@/lib/data/load-store";
import { formatAddress, getCustomerForUser, isProfileComplete } from "@/lib/data/repository";

export const metadata = { title: "Carrinho" };

export default async function CartPage({ params }: { params: Promise<{ loja: string }> }) {
  const store = await loadStore((await params).loja);
  const user = await getSessionUser();
  const customer = user ? await getCustomerForUser(store.id, user) : null;
  const viewer: CheckoutViewer = !user
    ? { state: "anon" }
    : !customer || !isProfileComplete(customer, store)
      ? { state: "incomplete" }
      : { state: "ready", name: customer.name, email: customer.email, address: formatAddress(customer.address!) };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Carrinho</h1>
      <Checkout slug={store.slug} shippingFlat={store.shippingFlat} freeShippingOver={store.freeShippingOver} viewer={viewer} />
    </main>
  );
}
