import { platformMetrics } from "@/lib/data/repository";
import { platformInsights } from "@/lib/insights";
import { handle } from "@/lib/validation";

export const GET = handle(async () => ({ metrics: await platformMetrics(), insights: await platformInsights() }));
