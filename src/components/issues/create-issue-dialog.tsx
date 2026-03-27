"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createIssue } from "@/server/actions/issue-actions";
import { IssueTypeIcon } from "./issue-type-icon";
import { IssuePriorityIcon } from "./issue-priority-icon";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ISSUE_TYPE_CONFIG, PRIORITY_CONFIG } from "@/lib/constants";
import type { MemberWithUser } from "@/types";
import type { BoardColumn } from "@/types/board";

const createIssueSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  type: z.enum(["EPIC", "STORY", "TASK", "BUG"]),
  priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"]),
  statusId: z.string(),
  assigneeId: z.string().nullable().optional(),
  description: z.any().optional(),
});
type CreateIssueInput = z.infer<typeof createIssueSchema>;

interface CreateIssueDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectPrefix: string;
  statuses: Pick<BoardColumn, "id" | "name" | "color">[];
  members: MemberWithUser[];
  labels: { id: string; name: string; color: string }[];
  workspaceSlug: string;
  projectKey: string;
}

export function CreateIssueDialog({
  open,
  onClose,
  projectId,
  projectPrefix,
  statuses,
  members,
  labels,
  workspaceSlug,
  projectKey,
}: CreateIssueDialogProps) {
  const router = useRouter();
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  const defaultStatus = statuses.find((s) => s.name === "Backlog") || statuses[0];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateIssueInput>({
    resolver: zodResolver(createIssueSchema),
    defaultValues: {
      title: "",
      type: "TASK",
      priority: "MEDIUM",
      statusId: defaultStatus?.id || "",
      assigneeId: null,
    },
  });

  const watchType = watch("type");
  const watchPriority = watch("priority");
  const watchStatus = watch("statusId");

  async function onSubmit(data: CreateIssueInput) {
    const result = await createIssue({
      ...data,
      projectId,
      labelIds: selectedLabels.length > 0 ? selectedLabels : undefined,
    });

    if (result.success) {
      toast.success(`Issue ${result.data.issue.key} created.`);
      reset();
      setSelectedLabels([]);
      onClose();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-issue-title"
        data-testid="create-issue-dialog"
        className="relative z-50 w-full max-w-xl rounded-xl border bg-card p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="create-issue-title" className="text-lg font-semibold">
            Create issue
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent" aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div>
            <input
              data-testid="issue-title-input"
              type="text"
              placeholder="Issue title"
              autoFocus
              className="w-full border-none bg-transparent text-lg font-medium placeholder:text-muted-foreground focus:outline-none"
              {...register("title")}
            />
            {errors.title && (
              <p className="mt-1 text-xs text-destructive" role="alert">{errors.title.message}</p>
            )}
          </div>

          {/* Selectors Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
              <select
                data-testid="issue-type-select"
                value={watchType}
                onChange={(e) => setValue("type", e.target.value as any)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(ISSUE_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select
                data-testid="issue-status-select"
                value={watchStatus}
                onChange={(e) => setValue("statusId", e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
              <select
                data-testid="issue-priority-select"
                value={watchPriority}
                onChange={(e) => setValue("priority", e.target.value as any)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Assignee</label>
              <select
                data-testid="issue-assignee-select"
                onChange={(e) => setValue("assigneeId", e.target.value || null)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name || m.user.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Labels</label>
            <div data-testid="issue-label-select" className="flex flex-wrap gap-1.5">
              {labels.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => {
                    setSelectedLabels((prev) =>
                      prev.includes(label.id)
                        ? prev.filter((id) => id !== label.id)
                        : [...prev, label.id]
                    );
                  }}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                    selectedLabels.includes(label.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
                  {label.name}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Due date</label>
            <input
              data-testid="issue-due-date-picker"
              type="date"
              className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Description placeholder */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              data-testid="issue-description-editor"
              placeholder="Add a description..."
              rows={3}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="create-issue-submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create issue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
