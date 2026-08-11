const FALLBACK_PATH = "/me";
const BASE_ORIGIN = "https://xiaozhi.invalid";
const unsafeCharacters = /[\\\u0000-\u001f\u007f]/;

function decodeLayers(value: string): string {
  let current = value;
  for (let index = 0; index < 3; index += 1) {
    const decoded = decodeURIComponent(current);
    if (decoded === current) return decoded;
    current = decoded;
  }
  return current;
}

export function safeNextPath(value: unknown, fallback = FALLBACK_PATH): string {
  if (typeof value !== "string" || value.trim() !== value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const decoded = decodeLayers(value);
    if (
      unsafeCharacters.test(value) ||
      unsafeCharacters.test(decoded) ||
      decoded.startsWith("//")
    ) {
      return fallback;
    }
    const parsed = new URL(value, BASE_ORIGIN);
    if (parsed.origin !== BASE_ORIGIN || !parsed.pathname.startsWith("/")) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
