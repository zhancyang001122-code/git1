import { createSocialHousingLeadsHandler } from "@/features/social-housing/list-api";
import { observeRoute } from "@/lib/route-observability";

export const dynamic = "force-dynamic";

export const GET = observeRoute(
  "/api/housing-leads",
  createSocialHousingLeadsHandler(),
);
