/**
 * Shared zod schemas for auth-related forms. Pulled out so the same
 * validation runs on Auth.tsx (signup/login), Onboarding, and any
 * future surface that takes an email + password.
 */
import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email")
  .email("That email looks invalid")
  .max(255, "Email is too long");

export const loginPasswordSchema = z
  .string()
  .min(6, "Password is at least 6 characters")
  .max(72, "Password is too long");

export const signupPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long")
  .refine(
    (v) => /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v),
    { message: "Mix upper, lower, and a number" },
  );

export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});
export type LoginValues = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: emailSchema,
  password: signupPasswordSchema,
  confirmPassword: signupPasswordSchema,
  agreedToTerms: z.boolean().refine((v) => v === true, {
    message: "You'll need to agree to the terms to continue",
  }),
}).refine((v) => v.password === v.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords don't match",
});
export type SignupValues = z.infer<typeof signupSchema>;
