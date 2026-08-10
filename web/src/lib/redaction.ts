const sensitiveKey =
  /(?:key|token|authorization|cookie|password|secret|service[_-]?role)/i;
const addressKey = /(?:preciseAddress|fullAddress|doorplate|addressDetail)/i;
const phoneKey = /(?:phone|mobile|telephone)/i;
const mainlandPhone = /(?<!\d)1[3-9]\d{9}(?!\d)/g;

function redactString(value: string): string {
  return value.replace(mainlandPhone, "[PHONE_REDACTED]");
}

export function redactForLogs(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactForLogs);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    output[key] = sensitiveKey.test(key)
      ? "[REDACTED]"
      : addressKey.test(key)
        ? "[ADDRESS_REDACTED]"
        : phoneKey.test(key)
          ? "[PHONE_REDACTED]"
          : redactForLogs(nested);
  }
  return output;
}
