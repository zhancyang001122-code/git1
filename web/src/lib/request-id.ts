import { z } from "zod";

const uuid = z.string().uuid();

export function requestIdFor(request: Request): string {
  const upstream = uuid.safeParse(request.headers.get("x-request-id"));
  return upstream.success ? upstream.data : crypto.randomUUID();
}
