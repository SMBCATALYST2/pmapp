/**
 * Authentication Zod validation schemas.
 * Shared between client forms and server actions.
 *
 * CRITIQUE APPLIED: Password requires min 8 chars + complexity
 * (uppercase + lowercase + number + special character).
 */

import { z } from "zod";

/** Password complexity regex: at least 1 uppercase, 1 lowercase, 1 digit, 1 special char */
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~])/;

export const signUpSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name too long")
    .trim(),
  email: z
    .string()
    .email("Invalid email address")
    .transform((e) => e.toLowerCase().trim()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password too long")
    .regex(
      passwordRegex,
      "Password must include uppercase, lowercase, number, and special character"
    ),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((e) => e.toLowerCase().trim()),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password too long")
      .regex(
        passwordRegex,
        "Password must include uppercase, lowercase, number, and special character"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
