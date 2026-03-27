"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { IssueWithRelations, MemberWithUser } from "@/types";
import { updateIssue, deleteIssue } from "@/server/actions/issue-actions";
import { IssueDetailSidebar } from "./issue-detail-sidebar";
import { IssueTitle } from "./issue-title";
import { IssueComments } from "./issue-comments";
import { IssueActivity } from "./issue-activity";
import { IssueTypeIcon } from "./issue-type-icon";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Trash2 } from "lucide-react";

interface IssueDetailProps {
  issue: IssueWithRelations;
  members: MemberWithUser[];
  labels: { id: string; name: string; color: string }[];
  workspaceSlug: string;
  projectKey: string;
  currentUserId: string;
}

export function IssueDetail({
  issue,
  members,
  labels,
  workspaceSlug,
  projectKey,
  currentUserId,
}: IssueDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"comments" | "activity">("comments");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  async function handleFieldUpdate(field: string, value: unknown) {
    const result = await updateIssue({
      id: issue.id,
      [field]: value,
      updatedAt: issue.updatedAt,
    });

    if (result.success) {
      router.refresh();
    } else {
      toast.error(result.error || `Failed to update ${field}.`);
    }
  }

  async function handleDelete() {
    const result = await deleteIssue(issue.id);
    if (result.success) {
      toast.success(`Issue ${issue.key} deleted.`);
      router.push(`/${workspaceSlug}/${projectKey}/board`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div data-testid="issue-detail-page" className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Issue Key & Type */}
        <div className="mb-4 flex items-center gap-2">
          <IssueTypeIcon type={issue.type} />
          <span className="text-sm font-medium text-muted-foreground">{issue.key}</span>
        </div>

        {/* Title */}
        <IssueTitle
          issueId={issue.id}
          initialTitle={issue.title}
          updatedAt={issue.updatedAt}
        />

        {/* Description */}
        <div data-testid="issue-description" className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Description</h3>
          <div data-testid="description-editor" className="min-h-[100px] rounded-lg border bg-background p-3 text-sm">
            {issue.description ? (
              <p>{typeof issue.description === "string" ? issue.description : "Rich text content"}</p>
            ) : (
              <p className="text-muted-foreground">Add a description...</p>
            )}
          </div>
        </div>

        {/* Comments / Activity Tabs */}
        <div className="mt-8">
          <div role="tablist" className="flex border-b">
            <button
              role="tab"
              data-testid="comments-tab"
              aria-selected={activeTab === "comments"}
              onClick={() => setActiveTab("comments")}
              className={`px-4 py-2 text-sm font-medium transition ${
                activeTab === "comments"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Comments
            </button>
            <button
              role="tab"
              data-testid="activity-tab"
              aria-selected={activeTab === "activity"}
              onClick={() => setActiveTab("activity")}
              className={`px-4 py-2 text-sm font-medium transition ${
                activeTab === "activity"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Activity
            </button>
          </div>

          <div role="tabpanel" className="mt-4">
            {activeTab === "comments" ? (
              <IssueComments issueId={issue.id} workspaceId={issue.project.workspaceId} currentUserId={currentUserId} />
            ) : (
              <IssueActivity issueId={issue.id} workspaceId={issue.project.workspaceId} />
            )}
          </div>
        </div>

        {/* Delete */}
        <div className="mt-8 border-t pt-6">
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="inline-flex items-center gap-2 text-sm text-destructive hover:underline"
          >
            <Trash2 className="h-4 w-4" />
            Delete issue
          </button>
        </div>

        <ConfirmDialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
          title={`Delete ${issue.key}?`}
          description="This action cannot be undone."
          confirmLabel="Delete"
          variant="destructive"
          data-testid="confirm-delete-dialog"
        />
      </div>

      {/* Sidebar */}
      <IssueDetailSidebar
        issue={issue}
        members={members}
        labels={labels}
        onFieldUpdate={handleFieldUpdate}
      />
    </div>
  );
}
