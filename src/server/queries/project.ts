/**
 * Project queries — re-export module for frontend compatibility.
 * Maps the function names the frontend expects to the actual implementations.
 */

export {
  getProjects,
  getSidebarProjects,
  getProject,
  getProjectStatuses,
  getBoardData,
  checkProjectKeyAvailability,
} from "./project-queries";

// Alias for frontend: getProjectByKey maps to getProject
export { getProject as getProjectByKey } from "./project-queries";
