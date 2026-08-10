import { createHmac, timingSafeEqual } from "node:crypto";

export const KNOWLEDGE_ADMIN_SESSION_COOKIE = "xiaozhi_knowledge_admin";
export function knowledgeAdminCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure,
    path: "/",
    maxAge: 60 * 60 * 4,
  };
}

function signature(token: string): string {
  return createHmac("sha256", token)
    .update("xiaozhi:knowledge-admin:v1")
    .digest("base64url");
}

export function createKnowledgeAdminSession(token: string): string {
  return `v1.${signature(token)}`;
}

export function verifyKnowledgeAdminSession(
  value: string | undefined,
  token: string,
): boolean {
  if (!value) return false;
  const expected = Buffer.from(createKnowledgeAdminSession(token));
  const actual = Buffer.from(value);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function bearerTokenMatches(
  authorization: string | null,
  expectedToken: string,
): boolean {
  const provided = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function cookieValue(header: string | null, name: string): string | undefined {
  return header
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)
    ?.slice(1)
    .join("=");
}

export function isKnowledgeAdminRequestAuthorized(
  request: Request,
  expectedToken: string,
): boolean {
  return (
    bearerTokenMatches(request.headers.get("authorization"), expectedToken) ||
    verifyKnowledgeAdminSession(
      cookieValue(
        request.headers.get("cookie"),
        KNOWLEDGE_ADMIN_SESSION_COOKIE,
      ),
      expectedToken,
    )
  );
}
