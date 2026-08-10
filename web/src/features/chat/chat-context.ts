import { z } from "zod";

const chatContextSchema = z
  .object({
    prompt: z.string().trim().min(1).max(500).optional(),
    source: z
      .enum(["home", "house", "deal", "market", "nearby", "community_post"])
      .optional(),
    entityId: z
      .string()
      .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .optional(),
    debug: z.boolean().default(false),
  })
  .strict();

export type ChatContext = z.infer<typeof chatContextSchema>;
type QueryValue = string | string[] | undefined;

function first(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseChatContext(query: Record<string, QueryValue>): {
  context: ChatContext;
  issues: readonly string[];
} {
  const candidate = {
    prompt: first(query.q) ?? first(query.prompt),
    source: first(query.source),
    entityId: first(query.id),
    debug: first(query.debug) === "true",
  };
  const result = chatContextSchema.safeParse(candidate);

  if (result.success) return { context: result.data, issues: [] };

  const fallback = chatContextSchema.parse({ debug: false });
  return {
    context: fallback,
    issues: result.error.issues.map((issue) => issue.message),
  };
}

export function buildChatHref(context: ChatContext): string {
  const value = chatContextSchema.parse(context);
  const params = new URLSearchParams();
  if (value.prompt) params.set("q", value.prompt);
  if (value.source) params.set("source", value.source);
  if (value.entityId) params.set("id", value.entityId);
  if (value.debug) params.set("debug", "true");
  const query = params.toString();
  return query ? `/xiaozhi/chat?${query}` : "/xiaozhi/chat";
}
