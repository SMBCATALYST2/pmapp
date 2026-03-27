"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { generateKeyBetween } from "fractional-indexing";
import { toast } from "sonner";
import type { BoardData, BoardColumn as BoardColumnType, BoardIssue } from "@/types/board";
import type { MemberWithUser } from "@/types";
import { BoardColumn } from "./board-column";
import { DragOverlayCard } from "./drag-overlay-card";
import { BoardFilters } from "./board-filters";
import { CreateIssueDialog } from "@/components/issues/create-issue-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { moveIssue } from "@/server/actions/issue-actions";
import { LayoutGrid, Plus } from "lucide-react";

interface BoardViewProps {
  boardData: BoardData;
  members: MemberWithUser[];
  labels: { id: string; name: string; color: string }[];
  workspaceSlug: string;
  projectKey: string;
}

export function BoardView({
  boardData,
  members,
  labels,
  workspaceSlug,
  projectKey,
}: BoardViewProps) {
  const [columns, setColumns] = useState<BoardColumnType[]>(boardData.columns);
  const [activeIssue, setActiveIssue] = useState<BoardIssue | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Filters
  const [filterAssignee, setFilterAssignee] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterLabel, setFilterLabel] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const hasActiveFilters =
    filterAssignee.length > 0 ||
    filterPriority.length > 0 ||
    filterType.length > 0 ||
    filterLabel.length > 0;

  const clearFilters = useCallback(() => {
    setFilterAssignee([]);
    setFilterPriority([]);
    setFilterType([]);
    setFilterLabel([]);
  }, []);

  // Apply filters to columns
  const filteredColumns = columns.map((col) => ({
    ...col,
    issues: col.issues.filter((issue) => {
      if (filterAssignee.length > 0 && !filterAssignee.includes(issue.assignee?.id || "")) return false;
      if (filterPriority.length > 0 && !filterPriority.includes(issue.priority)) return false;
      if (filterType.length > 0 && !filterType.includes(issue.type)) return false;
      if (filterLabel.length > 0 && !issue.labels.some((l) => filterLabel.includes(l.id))) return false;
      return true;
    }),
  }));

  const totalIssues = columns.reduce((sum, col) => sum + col.issues.length, 0);

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const issue = findIssue(active.id as string);
    setActiveIssue(issue || null);
  }

  function handleDragOver(event: DragOverEvent) {
    // Handle cross-column drag (move issue between columns optimistically)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveIssue(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find source and target columns
    const sourceCol = columns.find((col) =>
      col.issues.some((i) => i.id === activeId)
    );

    // Target could be a column or an issue
    let targetCol = columns.find((col) => col.id === overId);
    if (!targetCol) {
      targetCol = columns.find((col) =>
        col.issues.some((i) => i.id === overId)
      );
    }

    if (!sourceCol || !targetCol) return;

    const issue = sourceCol.issues.find((i) => i.id === activeId);
    if (!issue) return;

    // Calculate new position
    const targetIssues = targetCol.issues.filter((i) => i.id !== activeId);
    let overIndex = targetIssues.findIndex((i) => i.id === overId);
    if (overIndex === -1) overIndex = targetIssues.length;

    const before = targetIssues[overIndex - 1]?.position ?? null;
    const after = targetIssues[overIndex]?.position ?? null;

    let newPosition: string;
    try {
      newPosition = generateKeyBetween(before, after);
    } catch {
      newPosition = generateKeyBetween(null, null);
    }

    // Optimistic update
    setColumns((prev) =>
      prev.map((col) => {
        if (col.id === sourceCol.id && col.id === targetCol!.id) {
          // Same column reorder
          const issues = col.issues.filter((i) => i.id !== activeId);
          const updatedIssue = { ...issue, position: newPosition };
          issues.splice(overIndex, 0, updatedIssue);
          return { ...col, issues, issueCount: issues.length };
        }
        if (col.id === sourceCol.id) {
          const issues = col.issues.filter((i) => i.id !== activeId);
          return { ...col, issues, issueCount: issues.length };
        }
        if (col.id === targetCol!.id) {
          const issues = [...col.issues];
          const updatedIssue = { ...issue, position: newPosition };
          issues.splice(overIndex, 0, updatedIssue);
          return { ...col, issues, issueCount: issues.length };
        }
        return col;
      })
    );

    // Persist
    try {
      const result = await moveIssue({
        id: activeId,
        statusId: targetCol.id,
        position: newPosition,
      });
      if (!result.success) {
        toast.error("Failed to move issue. Please try again.");
        setColumns(boardData.columns); // Revert
      }
    } catch {
      toast.error("Failed to move issue. Please try again.");
      setColumns(boardData.columns); // Revert
    }
  }

  function findIssue(id: string): BoardIssue | undefined {
    for (const col of columns) {
      const issue = col.issues.find((i) => i.id === id);
      if (issue) return issue;
    }
    return undefined;
  }

  if (totalIssues === 0 && !hasActiveFilters) {
    return (
      <div className="flex h-full flex-col">
        <BoardFilters
          members={members}
          labels={labels}
          filterAssignee={filterAssignee}
          filterPriority={filterPriority}
          filterType={filterType}
          filterLabel={filterLabel}
          onFilterAssignee={setFilterAssignee}
          onFilterPriority={setFilterPriority}
          onFilterType={setFilterType}
          onFilterLabel={setFilterLabel}
          onClearAll={clearFilters}
        />
        <EmptyState
          data-testid="empty-board-state"
          icon={LayoutGrid}
          heading="No issues yet"
          description="Create your first issue to get started"
          actionLabel="Create issue"
          onAction={() => setShowCreateDialog(true)}
        />
        <CreateIssueDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          projectId={boardData.project.id}
          projectPrefix={boardData.project.prefix}
          statuses={columns}
          members={members}
          labels={labels}
          workspaceSlug={workspaceSlug}
          projectKey={projectKey}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-2">
        <BoardFilters
          members={members}
          labels={labels}
          filterAssignee={filterAssignee}
          filterPriority={filterPriority}
          filterType={filterType}
          filterLabel={filterLabel}
          onFilterAssignee={setFilterAssignee}
          onFilterPriority={setFilterPriority}
          onFilterType={setFilterType}
          onFilterLabel={setFilterLabel}
          onClearAll={clearFilters}
        />
        <button
          data-testid="create-issue-button"
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create issue
        </button>
      </div>

      {hasActiveFilters && filteredColumns.every((c) => c.issues.length === 0) && (
        <div data-testid="no-filter-results" className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">No issues match your filters</p>
          <button
            data-testid="clear-filters-button"
            onClick={clearFilters}
            className="text-sm font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {filteredColumns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              workspaceSlug={workspaceSlug}
              projectKey={projectKey}
              projectId={boardData.project.id}
              projectPrefix={boardData.project.prefix}
            />
          ))}
        </div>

        <DragOverlay>
          {activeIssue && (
            <DragOverlayCard issue={activeIssue} />
          )}
        </DragOverlay>
      </DndContext>

      <CreateIssueDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        projectId={boardData.project.id}
        projectPrefix={boardData.project.prefix}
        statuses={columns}
        members={members}
        labels={labels}
        workspaceSlug={workspaceSlug}
        projectKey={projectKey}
      />
    </div>
  );
}
