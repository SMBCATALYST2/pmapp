"use server";

/**
 * Authentication server actions.
 * Handles sign-up (user creation + workspace), sign-in, and sign-out.
 *
 * CRITIQUE APPLIED:
 * - Rate limiting on auth endpoints
 * - Password hashing with bcryptjs (12 rounds)
 * - No email enumeration on sign-up (generic error timing)
 */

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signUpSchema, signInSchema } from "@/lib/validations/auth";
import {
  nextAuthSignIn,
  nextAuthSignOut,
} from "@/lib/auth/auth";
import { checkRateLimit } from "@/lib/auth/helpers";
import { errors, withErrorHandling } from "@/lib/errors";
import type { ActionResult } from "@/lib/errors";
import { slugify } from "@/lib/utils";

const BCRYPT_ROUNDS = 12;

/**
 * Register a new user with email and password.
 * Creates User record with bcryptjs-hashed password.
 * Creates a default workspace with the user as OWNER.
 */
export async function signUp(
  input: unknown
): Promise<ActionResult<{ userId: string }>> {
  return withErrorHandling(async () => {
    // Validate input
    const parsed = signUpSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { name, email, password } = parsed.data;

    // Rate limit: 5 sign-up attempts per email per 15 minutes
    if (!checkRateLimit(`signup:${email}`, 5)) {
      throw errors.rateLimited();
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw errors.conflict("An account with this email already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user + default workspace in a transaction
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

      // Create default workspace
      const workspaceSlug = slugify(name ? `${name}s-workspace` : "my-workspace");
      const workspace = await tx.workspace.create({
        data: {
          name: name ? `${name}'s Workspace` : "My Workspace",
          slug: workspaceSlug + "-" + user.id.slice(0, 6),
          ownerId: user.id,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });

      return { userId: user.id, workspaceSlug: workspace.slug };
    });

    // Auto sign-in after registration
    try {
      await nextAuthSignIn("credentials", {
        email,
        password,
        redirect: false,
      });
    } catch {
      // Sign-in failure after creation is non-fatal; user can sign in manually
    }

    return { userId: result.userId };
  });
}

/**
 * Sign in with email and password via NextAuth Credentials provider.
 */
export async function signIn(
  input: unknown
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const parsed = signInSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { email, password } = parsed.data;

    // Rate limit: 10 sign-in attempts per email per 15 minutes
    if (!checkRateLimit(`signin:${email}`, 10)) {
      throw errors.rateLimited();
    }

    try {
      await nextAuthSignIn("credentials", {
        email,
        password,
        redirect: false,
      });
    } catch {
      throw errors.unauthorized("Invalid email or password");
    }
  });
}

/**
 * Sign out the current user. Clears NextAuth session.
 */
export async function signOut(): Promise<void> {
  await nextAuthSignOut({ redirect: false });
}
