/**
 * Label queries — re-export module for frontend compatibility.
 */

export {
  getLabelsByWorkspace,
  getLabelsByProject,
} from "./label-queries";

// Alias for frontend: getLabels maps to getLabelsByWorkspace
export { getLabelsByWorkspace as getLabels } from "./label-queries";
