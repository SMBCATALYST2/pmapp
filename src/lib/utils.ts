/**
 * General utility functions shared across the application.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names using clsx + tailwind-merge for shadcn/ui compatibility.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Generates an issue key from project prefix and number.
 * @example generateIssueKey("PROJ", 42) => "PROJ-42"
 */
export function generateIssueKey(prefix: string, number: number): string {
  return `${prefix}-${number}`;
}

/**
 * Converts a string to a URL-safe slug.
 * Lowercases, replaces spaces/special chars with hyphens, removes consecutive hyphens.
 * @example slugify("My Workspace Name") => "my-workspace-name"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Auto-generates a project key from a project name.
 * Takes first letters of each word, up to 4 characters, uppercase.
 * @example generateProjectKey("Mobile App") => "MA"
 * @example generateProjectKey("Backend Services Platform") => "BSP"
 */
export function generateProjectKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  if (words.length === 1) {
    // Single word: take first 2-4 chars
    return words[0]!.slice(0, Math.max(2, Math.min(4, words[0]!.length))).toUpperCase();
  }

  // Multiple words: take first letter of each, up to 4
  return words
    .slice(0, 4)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Extracts plain text from Tiptap JSON content for search indexing.
 * Recursively walks the document tree and concatenates text nodes.
 */
export function extractTextFromTiptap(json: unknown): string {
  if (!json || typeof json !== "object") return "";

  const node = json as { type?: string; text?: string; content?: unknown[] };

  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }

  if (Array.isArray(node.content)) {
    return node.content
      .map((child) => extractTextFromTiptap(child))
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

/**
 * Generates a cryptographically random token for invites.
 * Uses crypto.randomUUID() per security critique (not nanoid).
 */
export function generateInviteToken(): string {
  return crypto.randomUUID();
}

/**
 * Checks if a given role meets the minimum required role level.
 * Uses the ROLE_HIERARCHY from constants.
 */
export function hasMinimumRole(
  userRole: string,
  requiredRole: string,
  roleHierarchy: Record<string, number>
): boolean {
  const userLevel = roleHierarchy[userRole] ?? 0;
  const requiredLevel = roleHierarchy[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

/**
 * Truncates text to a maximum length, appending ellipsis if truncated.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Format a relative date (e.g., "2 hours ago", "3 days ago").
 */
export function formatRelativeDate(date: Date | string): string {
  const now = new Date();
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Get user initials from name.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}
