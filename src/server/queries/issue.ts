/**
 * Issue queries — re-export module for frontend compatibility.
 * Maps the function names the frontend expects to the actual implementations.
 */

export {
  getIssue,
  getIssuesByProject,
  getIssuesByStatus,
  searchIssues,
} from "./issue-queries";

// Aliases for frontend compatibility
export { getIssue as getIssueByKey } from "./issue-queries";
export { getIssuesByProject as getProjectIssues } from "./issue-queries";
