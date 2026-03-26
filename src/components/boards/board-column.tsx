"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { BoardColumn as BoardColumnType } from "@/types/board";
import { BoardCard } from "./board-card";
import { QuickCreateIssue } from "./quick-create-issue";

interface BoardColumnProps {
  column: BoardColumnType;
  workspaceSlug: string;
  projectKey: string;
  projectId: string;
  projectPrefix: string;
}

export function BoardColumn({
  column,
  workspaceSlug,
  projectKey,
  projectId,
  projectPrefix,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      data-testid={`board-column-${column.name}`}
      className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/30"
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: column.color }}
        />
        <h3 className="text-sm font-medium">{column.name}</h3>
        <span
          data-testid={`column-count-${column.name}`}
          className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {column.issues.length}
        </span>
      </div>

      {/* Issue Cards */}
      <div
        ref={setNodeRef}
        className={`flex min-h-[100px] flex-1 flex-col gap-2 px-2 pb-2 transition ${
          isOver ? "bg-primary/5 ring-2 ring-primary/20 ring-inset rounded-lg" : ""
        }`}
      >
        <SortableContext
          items={column.issues.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.issues.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No issues
            </p>
          )}
          {column.issues.map((issue) => (
            <BoardCard
              key={issue.id}
              issue={issue}
              workspaceSlug={workspaceSlug}
              projectKey={projectKey}
            />
          ))}
        </SortableContext>
      </div>

      {/* Quick Add */}
      <QuickCreateIssue
        statusId={column.id}
        projectId={projectId}
        projectPrefix={projectPrefix}
      />
    </div>
  );
}
