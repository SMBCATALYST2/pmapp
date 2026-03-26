"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BoardIssue } from "@/types/board";
import { IssueTypeIcon } from "@/components/issues/issue-type-icon";
import { IssuePriorityIcon } from "@/components/issues/issue-priority-icon";
import { UserAvatar } from "@/components/shared/user-avatar";
import { format, isPast, isWithinInterval, addDays } from "date-fns";

interface BoardCardProps {
  issue: BoardIssue;
  workspaceSlug: string;
  projectKey: string;
}

export function BoardCard({ issue, workspaceSlug, projectKey }: BoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOverdue =
    issue.dueDate && isPast(new Date(issue.dueDate));
  const isDueSoon =
    issue.dueDate &&
    !isOverdue &&
    isWithinInterval(new Date(issue.dueDate), {
      start: new Date(),
      end: addDays(new Date(), 3),
    });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={`issue-card-${issue.key}`}
      aria-label={`${issue.key}: ${issue.title}, ${issue.priority} priority${issue.assignee ? `, assigned to ${issue.assignee.name}` : ""}`}
      className="group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
    >
      {/* Top row: type icon + key + priority */}
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <IssueTypeIcon type={issue.type} className="h-3.5 w-3.5" />
          <Link
            href={`/${workspaceSlug}/${projectKey}/issues/${issue.key}`}
            data-testid={`card-key-${issue.key}`}
            className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {issue.key}
          </Link>
        </div>
        <span data-testid={`card-priority-${issue.key}`}>
          <IssuePriorityIcon priority={issue.priority} className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* Title */}
      <p
        data-testid={`card-title-${issue.key}`}
        className="line-clamp-2 text-sm font-medium leading-snug"
      >
        {issue.title}
      </p>

      {/* Labels */}
      {issue.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {issue.labels.slice(0, 3).map((label) => (
            <span
              key={label.id}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: label.color }}
              title={label.name}
            />
          ))}
          {issue.labels.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{issue.labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Bottom row: due date + assignee */}
      <div className="mt-2 flex items-center justify-between">
        <div>
          {issue.dueDate && (
            <span
              className={`text-[10px] font-medium ${
                isOverdue
                  ? "text-destructive"
                  : isDueSoon
                    ? "text-orange-500"
                    : "text-muted-foreground"
              }`}
            >
              {isOverdue ? "Overdue" : format(new Date(issue.dueDate), "MMM d")}
            </span>
          )}
        </div>
        {issue.assignee && (
          <span data-testid={`card-assignee-${issue.key}`}>
            <UserAvatar
              name={issue.assignee.name}
              image={issue.assignee.image}
              size="sm"
            />
          </span>
        )}
      </div>
    </div>
  );
}
