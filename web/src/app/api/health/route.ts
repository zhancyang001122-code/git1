import { getServiceConfiguration } from "@/lib/env";
import { requestIdFor } from "@/lib/request-id";

export function GET(request?: Request): Response {
  const configuration = getServiceConfiguration();
  const requestId = request ? requestIdFor(request) : crypto.randomUUID();

  return Response.json(
    {
      app: "xiaozhi",
      mode: configuration.mode,
      services: configuration.services,
    },
    { headers: { "cache-control": "no-store", "x-request-id": requestId } },
  );
}
