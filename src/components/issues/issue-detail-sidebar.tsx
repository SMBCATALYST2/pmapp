"use client";

import type { IssueWithRelations, MemberWithUser } from "@/types";
import { PRIORITY_CONFIG, ISSUE_TYPE_CONFIG } from "@/lib/constants";
import { IssueStatusBadge } from "./issue-status-badge";
import { IssuePriorityIcon } from "./issue-priority-icon";
import { IssueTypeIcon } from "./issue-type-icon";
import { IssueLabelBadge } from "./issue-label-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatRelativeDate } from "@/lib/utils";
import { format } from "date-fns";

interface IssueDetailSidebarProps {
  issue: IssueWithRelations;
  members: MemberWithUser[];
  labels: { id: string; name: string; color: string }[];
  onFieldUpdate: (field: string, value: unknown) => Promise<void>;
}

export function IssueDetailSidebar({
  issue,
  members,
  labels,
  onFieldUpdate,
}: IssueDetailSidebarProps) {
  return (
    <div
      data-testid="issue-detail-sidebar"
      className="w-80 shrink-0 overflow-y-auto border-l bg-muted/10 p-6"
    >
      <div className="space-y-5">
        {/* Status */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Status</label>
          <select
            data-testid="issue-status-dropdown"
            value={issue.status.id}
            onChange={(e) => onFieldUpdate("statusId", e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {issue.project && (
              <option value={issue.status.id}>{issue.status.name}</option>
            )}
          </select>
        </div>

        {/* Assignee */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Assignee</label>
          <select
            data-testid="issue-assignee-picker"
            value={issue.assignee?.id || ""}
            onChange={(e) => onFieldUpdate("assigneeId", e.target.value || null)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name || m.user.email}
              </option>
            ))}
          </select>
          {issue.assignee && (
            <div className="mt-1.5 flex items-center gap-2">
              <UserAvatar name={issue.assignee.name} image={issue.assignee.image} size="sm" />
              <span className="text-sm">{issue.assignee.name}</span>
            </div>
          )}
        </div>

        {/* Priority */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Priority</label>
          <select
            data-testid="issue-priority-dropdown"
            value={issue.priority}
            onChange={(e) => onFieldUpdate("priority", e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Type</label>
          <select
            value={issue.type}
            onChange={(e) => onFieldUpdate("type", e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(ISSUE_TYPE_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        {/* Labels */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Labels</label>
          <div data-testid="issue-label-picker" className="flex flex-wrap gap-1">
            {issue.labels.length === 0 && (
              <span className="text-sm text-muted-foreground">No labels</span>
            )}
            {issue.labels.map((label) => (
              <IssueLabelBadge key={label.id} name={label.name} color={label.color} />
            ))}
          </div>
        </div>

        {/* Due Date */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Due date</label>
          <input
            data-testid="issue-due-date-trigger"
            type="date"
            value={issue.dueDate ? format(new Date(issue.dueDate), "yyyy-MM-dd") : ""}
            onChange={(e) => onFieldUpdate("dueDate", e.target.value ? new Date(e.target.value) : null)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Reporter */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Reporter</label>
          <div className="flex items-center gap-2">
            <UserAvatar name={issue.reporter.name} image={issue.reporter.image} size="sm" />
            <span className="text-sm">{issue.reporter.name}</span>
          </div>
        </div>

        {/* Dates */}
        <div className="space-y-2 border-t pt-4 text-xs text-muted-foreground">
          <div>
            <span>Created </span>
            <span>{formatRelativeDate(issue.createdAt)}</span>
          </div>
          <div>
            <span>Updated </span>
            <span>{formatRelativeDate(issue.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
