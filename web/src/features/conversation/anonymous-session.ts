import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { AppError } from "@/lib/errors";

export const ANONYMOUS_SESSION_COOKIE = "xiaozhi_anonymous_session";

function validateSecret(secret: string) {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new AppError({
      code: "ANONYMOUS_COOKIE_SECRET_INVALID",
      message: "匿名会话签名密钥配置无效",
    });
  }
}

function signature(anonymousId: string, secret: string): string {
  return createHmac("sha256", secret).update(anonymousId).digest("base64url");
}

export function createAnonymousSessionCookie(secret: string): {
  anonymousId: string;
  value: string;
} {
  validateSecret(secret);
  const anonymousId = randomBytes(32).toString("base64url");
  return {
    anonymousId,
    value: `${anonymousId}.${signature(anonymousId, secret)}`,
  };
}

export function readAnonymousSessionCookie(
  value: string | undefined,
  secret: string,
): string | null {
  validateSecret(secret);
  if (!value) return null;
  const [anonymousId, providedSignature, ...extra] = value.split(".");
  if (
    !anonymousId ||
    !providedSignature ||
    extra.length > 0 ||
    !/^[A-Za-z0-9_-]{43}$/.test(anonymousId)
  ) {
    return null;
  }
  const expected = Buffer.from(signature(anonymousId, secret));
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length) return null;
  return timingSafeEqual(expected, provided) ? anonymousId : null;
}

export const anonymousSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
