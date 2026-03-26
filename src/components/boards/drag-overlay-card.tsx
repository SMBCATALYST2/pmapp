import type { BoardIssue } from "@/types/board";
import { IssueTypeIcon } from "@/components/issues/issue-type-icon";
import { IssuePriorityIcon } from "@/components/issues/issue-priority-icon";

interface DragOverlayCardProps {
  issue: BoardIssue;
}

export function DragOverlayCard({ issue }: DragOverlayCardProps) {
  return (
    <div className="w-72 rotate-3 rounded-lg border bg-card p-3 shadow-xl">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <IssueTypeIcon type={issue.type} className="h-3.5 w-3.5" />
          <span className="text-xs font-medium text-muted-foreground">
            {issue.key}
          </span>
        </div>
        <IssuePriorityIcon priority={issue.priority} className="h-3.5 w-3.5" />
      </div>
      <p className="line-clamp-2 text-sm font-medium">{issue.title}</p>
    </div>
  );
}
