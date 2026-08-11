import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());

export const otpSendSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const otpVerifySchema = z
  .object({
    email: emailSchema,
    token: z
      .string()
      .trim()
      .regex(/^\d{6}$/),
    next: z.string().max(2_048).optional(),
  })
  .strict();

export type OtpSendInput = z.infer<typeof otpSendSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
