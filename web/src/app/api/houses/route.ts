import { createHousesHandler } from "@/features/business/api-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createHousesHandler();
