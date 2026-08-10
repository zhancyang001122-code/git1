import { createChatHandler } from "@/features/agent/chat-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createChatHandler();
