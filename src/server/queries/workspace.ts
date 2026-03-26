/**
 * Workspace queries — re-export module for frontend compatibility.
 * Maps the function names the frontend expects to the actual implementations.
 */

export {
  getUserWorkspaces,
  getWorkspace,
  getWorkspaceMembers,
  getWorkspaceInvitations,
  checkSlugAvailability,
} from "./workspace-queries";

// Alias for frontend: getWorkspaceBySlug maps to getWorkspace
export { getWorkspace as getWorkspaceBySlug } from "./workspace-queries";
