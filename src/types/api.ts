/**
 * API response types used across server actions and API routes.
 */

/** Universal server action result wrapper */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Paginated response for list views */
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
}

/** Search result for the Cmd+K command palette */
export interface SearchResult {
  id: string;
  key: string;
  title: string;
  projectName: string;
  projectPrefix: string;
  projectColor: string | null;
  status: {
    name: string;
    color: string;
  };
  assignee: {
    name: string | null;
    image: string | null;
  } | null;
}

/** Error response from API routes */
export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}
