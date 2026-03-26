/**
 * NextAuth.js catch-all API route handler.
 * Delegates to the handlers exported from the auth configuration.
 */

import { handlers } from "@/lib/auth/auth";

export const { GET, POST } = handlers;
