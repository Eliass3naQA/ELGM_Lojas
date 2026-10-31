import { getSessionUser, requireUser } from "@/lib/auth/session";
import { DomainError, getCustomerForUser, getOrder, getReceiptFile, getStoreBySlug, submitReceipt } from "@/lib/data/repository";
import { handle } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string; id: string }> };

// Comprador envia o comprovante (multipart/form-data, campo "file").
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  const user = await requireUser();
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw new DomainError("Selecione o arquivo do comprovante.");
  return submitReceipt(slug, id, user, { name: file.name, mimeType: file.type, data: Buffer.from(await file.arrayBuffer()) });
});

// Visualização do comprovante: o próprio comprador ou o painel da loja.
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) throw new DomainError("Loja não encontrada.", 404);
  const order = await getOrder(store.id, id);
  if (!order) throw new DomainError("Pedido não encontrado.", 404);
  // TODO(auth): quando o painel tiver login, liberar apenas para o dono da loja ou o comprador do pedido.
  const user = await getSessionUser();
  const isBuyer = user ? (await getCustomerForUser(store.id, user))?.id === order.customerId : false;
  const fromPanel = new URL(req.url).searchParams.get("painel") === "1";
  if (!isBuyer && !fromPanel) throw new DomainError("Sem permissão.", 403);

  const file = await getReceiptFile(store.id, id);
  if (!file) throw new DomainError("Comprovante não encontrado.", 404);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
      // arquivos enviados por usuários: nada de scripts, nada de sniffing
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});
