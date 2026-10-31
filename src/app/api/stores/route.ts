import { createStore, listStores } from "@/lib/data/repository";
import { handle, storeCreateSchema } from "@/lib/validation";

// Backoffice: listar e criar lojas.
export const GET = handle(async () => listStores());

export const POST = handle(async (req: Request) => createStore(storeCreateSchema.parse(await req.json())));
