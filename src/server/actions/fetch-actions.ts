"use server";

import { getCommentsByIssue, getActivitiesByIssue } from "@/server/queries/comment-queries";
import type { CommentWithAuthor, ActivityWithActor } from "@/types";

export async function fetchIssueComments(
  issueId: string,
  workspaceId: string
): Promise<CommentWithAuthor[]> {
  return getCommentsByIssue(issueId, workspaceId);
}

export async function fetchIssueActivities(
  issueId: string,
  workspaceId: string
): Promise<ActivityWithActor[]> {
  return getActivitiesByIssue(issueId, workspaceId);
}
