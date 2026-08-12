import { createCommunityPostsHandler } from "@/features/business/api-handlers";
import { observeRoute } from "@/lib/route-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = observeRoute(
  "/api/community-posts",
  createCommunityPostsHandler(),
);
