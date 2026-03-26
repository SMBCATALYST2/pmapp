/**
 * Board view type definitions for the Kanban board.
 * Used by board components and drag-and-drop logic.
 */

import type { IssueType, Priority, StatusCategory } from "@prisma/client";

/** Lightweight issue representation for board cards */
export interface BoardIssue {
  id: string;
  key: string;
  title: string;
  type: IssueType;
  priority: Priority;
  position: string;
  dueDate: Date | null;
  assignee: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  labels: {
    id: string;
    name: string;
    color: string;
  }[];
}

/** A board column: status with its issues */
export interface BoardColumn {
  id: string;
  name: string;
  category: StatusCategory;
  color: string;
  position: number;
  issues: BoardIssue[];
  issueCount: number;
}

/** Full board data passed from server to client */
export interface BoardData {
  columns: BoardColumn[];
  project: {
    id: string;
    name: string;
    prefix: string;
  };
}

/** Data attached to a draggable item for dnd-kit */
export interface DragData {
  type: "issue";
  issue: BoardIssue;
  columnId: string;
  index: number;
}

/** Data attached to a droppable column for dnd-kit */
export interface DropColumnData {
  type: "column";
  columnId: string;
}

/** Describes a drag operation's result */
export interface DragResult {
  issueId: string;
  fromColumnId: string;
  toColumnId: string;
  newPosition: string;
}
