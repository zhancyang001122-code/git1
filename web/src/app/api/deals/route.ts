import { createDealsHandler } from "@/features/business/api-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createDealsHandler();
