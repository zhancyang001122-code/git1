import { z } from "zod";

export const DEMO_LOGIN_CODE = "666666";

export const demoLoginSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/),
    next: z.string().max(2_048).optional(),
  })
  .strict();

export type DemoLoginInput = z.infer<typeof demoLoginSchema>;
