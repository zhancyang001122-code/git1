import { getServiceConfiguration } from "@/lib/env";

export function GET(): Response {
  const configuration = getServiceConfiguration();

  return Response.json({
    app: "xiaozhi",
    mode: configuration.mode,
    services: configuration.services,
  });
}
