/**
 * Activity queries — re-export module for frontend compatibility.
 */

export { getActivitiesByIssue } from "./comment-queries";
export { getCommentsByIssue } from "./comment-queries";

// Aliases for frontend
export { getActivitiesByIssue as getIssueActivities } from "./comment-queries";
export { getCommentsByIssue as getIssueComments } from "./comment-queries";
