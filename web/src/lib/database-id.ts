import { z } from "zod";

// PostgreSQL accepts every canonical 128-bit UUID representation, including
// deterministic seed ids whose RFC version nibble is 0. Database boundaries
// must validate the storage format without inventing a stricter version rule.
export const postgresUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
