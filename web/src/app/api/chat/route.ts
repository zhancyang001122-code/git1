import { createChatHandler } from "@/features/agent/chat-handler";
import { observeRoute } from "@/lib/route-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = observeRoute("/api/chat", createChatHandler());
