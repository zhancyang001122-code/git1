import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());

const captchaTokenSchema = z.string().trim().min(16).max(4_096);

export const otpSendSchema = z
  .object({
    email: emailSchema,
    captchaToken: captchaTokenSchema.optional(),
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
