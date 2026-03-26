/**
 * NextAuth.js v5 (Auth.js) configuration.
 * Credentials provider with email/password (bcryptjs).
 * JWT strategy with session callback enrichment.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { JWT } from "next-auth/jwt";

export const {
  handlers,
  auth,
  signIn: nextAuthSignIn,
  signOut: nextAuthSignOut,
} = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },

  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });

        if (!user || !user.password) {
          // User doesn't exist or is an OAuth-only account
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }): Promise<JWT> {
      // On initial sign-in, `user` is populated
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (token.email) {
        session.user.email = token.email;
      }
      if (token.name !== undefined) {
        session.user.name = token.name;
      }
      if (token.picture !== undefined) {
        session.user.image = token.picture;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Allow relative callbacks
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allow same-origin callbacks
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  events: {
    async linkAccount({ user }) {
      // Auto-verify email for OAuth users
      if (user.id) {
        await db.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }
    },
  },
});
