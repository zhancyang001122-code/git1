import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { AppError } from "@/lib/errors";

const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const sessionTitle = z.string().trim().min(1).max(120).default("新对话");
const anonymousId = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);
const createSessionSchema = z.union([
  z.object({ userId: uuid, title: sessionTitle }).strict(),
  z.object({ anonymousId, title: sessionTitle }).strict(),
]);
const messageRole = z.enum(["system", "user", "assistant", "tool"]);
const appendMessageSchema = z
  .object({
    sessionId: uuid,
    role: messageRole,
    content: z.string().max(30_000),
    structuredPayload: z.unknown().nullable().optional(),
    modelName: z.string().trim().min(1).max(120).nullable().optional(),
    inputTokens: z.number().int().nonnegative().nullable().optional(),
    outputTokens: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();
const listSchema = z
  .object({ limit: z.number().int().min(1).max(100).default(50) })
  .strict();

const sessionRowSchema = z
  .object({
    id: uuid,
    user_id: uuid.nullable(),
    anonymous_id: anonymousId.nullable(),
    title: z.string(),
    summary: z.string(),
    last_location_label: z.string().nullable(),
    last_longitude: z.coerce.number().nullable(),
    last_latitude: z.coerce.number().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .refine(
    (value) => (value.user_id === null) !== (value.anonymous_id === null),
    "会话必须且只能有一个所有者",
  );
const messageRowSchema = z.object({
  id: uuid,
  session_id: uuid,
  role: messageRole,
  content: z.string(),
  structured_payload: z.unknown().nullable(),
  model_name: z.string().nullable(),
  input_tokens: z.number().int().nullable(),
  output_tokens: z.number().int().nullable(),
  created_at: z.string(),
});

const SESSION_COLUMNS =
  "id,user_id,anonymous_id,title,summary,last_location_label,last_longitude,last_latitude,created_at,updated_at";
const MESSAGE_COLUMNS =
  "id,session_id,role,content,structured_payload,model_name,input_tokens,output_tokens,created_at";

export interface ConversationSession {
  id: string;
  userId: string | null;
  anonymousId: string | null;
  title: string;
  summary: string;
  lastLocationLabel: string | null;
  location: { longitude: number; latitude: number } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: z.infer<typeof messageRole>;
  content: string;
  structuredPayload: unknown | null;
  modelName: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
}

export interface ConversationRepository {
  createSession(
    input: z.input<typeof createSessionSchema>,
  ): Promise<ConversationSession>;
  getSession(sessionId: string): Promise<ConversationSession | null>;
  listSessions(
    userId: string,
    options?: z.input<typeof listSchema>,
  ): Promise<readonly ConversationSession[]>;
  appendMessage(
    input: z.input<typeof appendMessageSchema>,
  ): Promise<ConversationMessage>;
  listMessages(
    sessionId: string,
    options?: z.input<typeof listSchema>,
  ): Promise<readonly ConversationMessage[]>;
}

function invalidInput(cause: unknown): never {
  throw new AppError({
    code: "INVALID_CONVERSATION_INPUT",
    message: "对话参数无效",
    cause,
  });
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) invalidInput(result.error);
  return result.data;
}

function queryFailed(cause: unknown): never {
  throw new AppError({
    code: "SUPABASE_QUERY_FAILED",
    message: "对话记录暂时不可用",
    retryable: true,
    cause,
  });
}

function mapSession(row: unknown): ConversationSession {
  const result = sessionRowSchema.safeParse(row);
  if (!result.success)
    throw new AppError({
      code: "DATA_CONTRACT_INVALID",
      message: "对话会话数据格式无效",
      cause: result.error,
    });
  const value = result.data;
  const location =
    value.last_longitude === null || value.last_latitude === null
      ? null
      : { longitude: value.last_longitude, latitude: value.last_latitude };
  return {
    id: value.id,
    userId: value.user_id,
    anonymousId: value.anonymous_id,
    title: value.title,
    summary: value.summary,
    lastLocationLabel: value.last_location_label,
    location,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

function mapMessage(row: unknown): ConversationMessage {
  const result = messageRowSchema.safeParse(row);
  if (!result.success)
    throw new AppError({
      code: "DATA_CONTRACT_INVALID",
      message: "对话消息数据格式无效",
      cause: result.error,
    });
  const value = result.data;
  return {
    id: value.id,
    sessionId: value.session_id,
    role: value.role,
    content: value.content,
    structuredPayload: value.structured_payload,
    modelName: value.model_name,
    inputTokens: value.input_tokens,
    outputTokens: value.output_tokens,
    createdAt: value.created_at,
  };
}

export function createSupabaseConversationRepository(
  client: SupabaseClient,
): ConversationRepository {
  return {
    async createSession(input) {
      const value = parse(createSessionSchema, input);
      const result = await client
        .from("conversation_sessions")
        .insert(
          "userId" in value
            ? { user_id: value.userId, title: value.title }
            : { anonymous_id: value.anonymousId, title: value.title },
        )
        .select(SESSION_COLUMNS)
        .single();
      if (result.error) queryFailed(result.error);
      return mapSession(result.data);
    },

    async getSession(inputSessionId) {
      const sessionId = parse(uuid, inputSessionId);
      const result = await client
        .from("conversation_sessions")
        .select(SESSION_COLUMNS)
        .eq("id", sessionId)
        .maybeSingle();
      if (result.error) queryFailed(result.error);
      return result.data ? mapSession(result.data) : null;
    },

    async listSessions(inputUserId, options = {}) {
      const userId = parse(uuid, inputUserId);
      const { limit } = parse(listSchema, options);
      const result = await client
        .from("conversation_sessions")
        .select(SESSION_COLUMNS)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(limit);
      if (result.error) queryFailed(result.error);
      return (result.data ?? []).map(mapSession);
    },

    async appendMessage(input) {
      const value = parse(appendMessageSchema, input);
      const result = await client
        .from("conversation_messages")
        .insert({
          session_id: value.sessionId,
          role: value.role,
          content: value.content,
          structured_payload: value.structuredPayload ?? null,
          model_name: value.modelName ?? null,
          input_tokens: value.inputTokens ?? null,
          output_tokens: value.outputTokens ?? null,
        })
        .select(MESSAGE_COLUMNS)
        .single();
      if (result.error) queryFailed(result.error);
      return mapMessage(result.data);
    },

    async listMessages(inputSessionId, options = {}) {
      const sessionId = parse(uuid, inputSessionId);
      const { limit } = parse(listSchema, options);
      const result = await client
        .from("conversation_messages")
        .select(MESSAGE_COLUMNS)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);
      if (result.error) queryFailed(result.error);
      return (result.data ?? []).map(mapMessage).reverse();
    },
  };
}
