import { createHousesHandler } from "@/features/business/api-handlers";
import { createHistoricalHousesHandler } from "@/features/housing/list-api";
import { publicEnv } from "@/lib/env";
import { observeRoute } from "@/lib/route-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const demoHandler = createHousesHandler();
const historicalHandler = createHistoricalHousesHandler();

export const GET = observeRoute("/api/houses", (request) =>
  publicEnv().NEXT_PUBLIC_DEMO_MODE
    ? demoHandler(request)
    : historicalHandler(request),
);
