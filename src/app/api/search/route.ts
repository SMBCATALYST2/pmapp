/**
 * Search API route for the Cmd+K command palette.
 * GET /api/search?workspaceId=xxx&query=yyy&limit=10
 *
 * This is a GET API route (not a server action) because it is called
 * from the client-side cmdk command palette with debounced fetches.
 *
 * CRITIQUE APPLIED:
 * - Rate limiting consideration (basic request validation)
 * - Workspace membership verification
 * - Input validation with Zod
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { searchIssuesSchema } from "@/lib/validations/issue";
import type { SearchResult, ApiError } from "@/types/api";

export async function GET(request: Request): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" } satisfies ApiError,
        { status: 401 }
      );
    }

    // Parse search params
    const url = new URL(request.url);
    const parsed = searchIssuesSchema.safeParse({
      workspaceId: url.searchParams.get("workspaceId"),
      query: url.searchParams.get("query"),
      limit: url.searchParams.get("limit")
        ? Number(url.searchParams.get("limit"))
        : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid parameters",
          details: parsed.error.flatten().fieldErrors,
        } satisfies ApiError,
        { status: 400 }
      );
    }

    const { workspaceId, query, limit } = parsed.data;

    // Verify workspace membership
    const membership = await db.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: session.user.id,
          workspaceId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not a workspace member" } satisfies ApiError,
        { status: 403 }
      );
    }

    // Search issues
    const issues = await db.issue.findMany({
      where: {
        deletedAt: null,
        project: {
          workspaceId,
          deletedAt: null,
        },
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { key: { contains: query, mode: "insensitive" } },
          { descriptionText: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        key: true,
        title: true,
        status: {
          select: { name: true, color: true },
        },
        assignee: {
          select: { name: true, image: true },
        },
        project: {
          select: { name: true, prefix: true, color: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    const results: SearchResult[] = issues.map((issue) => ({
      id: issue.id,
      key: issue.key,
      title: issue.title,
      projectName: issue.project.name,
      projectPrefix: issue.project.prefix,
      projectColor: issue.project.color,
      status: {
        name: issue.status.name,
        color: issue.status.color,
      },
      assignee: issue.assignee
        ? {
            name: issue.assignee.name,
            image: issue.assignee.image,
          }
        : null,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" } satisfies ApiError,
      { status: 500 }
    );
  }
}
