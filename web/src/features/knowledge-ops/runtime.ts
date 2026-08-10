import "server-only";

import { createDemoKnowledgeOpsService } from "@/features/knowledge-ops/demo-store";
import type { KnowledgeOpsService } from "@/features/knowledge-ops/service";
import { AppError } from "@/lib/errors";
import { parsePublicEnv, parseServerEnv } from "@/lib/env";

export interface KnowledgeOpsRuntime {
  mode: "demo" | "live";
  service: KnowledgeOpsService;
  adminToken: string | undefined;
}

export async function createKnowledgeOpsRuntime(): Promise<KnowledgeOpsRuntime> {
  const publicConfiguration = parsePublicEnv(process.env);
  const serverConfiguration = parseServerEnv(process.env);
  if (publicConfiguration.NEXT_PUBLIC_DEMO_MODE) {
    return {
      mode: "demo",
      service: createDemoKnowledgeOpsService(),
      adminToken: serverConfiguration.DEMO_ADMIN_TOKEN,
    };
  }
  throw new AppError({
    code: "KNOWLEDGE_OPS_LIVE_NOT_CONFIGURED",
    message: "真实知识运营服务尚未完整配置",
    status: 503,
  });
}
