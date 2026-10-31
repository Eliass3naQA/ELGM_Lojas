import { listPlans } from "@/lib/data/repository";
import { handle } from "@/lib/validation";

export const GET = handle(async () => listPlans());
