import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  KNOWLEDGE_ADMIN_SESSION_COOKIE,
  verifyKnowledgeAdminSession,
} from "@/features/knowledge-ops/admin-session";
import { parseServerEnv } from "@/lib/env";

export async function requireKnowledgeAdminPage(): Promise<void> {
  const token = parseServerEnv(process.env).DEMO_ADMIN_TOKEN;
  if (!token) redirect("/knowledge-admin/login?status=not-configured");
  const cookieStore = await cookies();
  const session = cookieStore.get(KNOWLEDGE_ADMIN_SESSION_COOKIE)?.value;
  if (!verifyKnowledgeAdminSession(session, token)) {
    redirect("/knowledge-admin/login");
  }
}
