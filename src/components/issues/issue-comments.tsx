"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { createComment, updateComment, deleteComment } from "@/server/actions/comment";
import { getIssueComments } from "@/server/queries/activity";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatRelativeDate } from "@/lib/utils";
import type { CommentWithAuthor } from "@/types";

interface IssueCommentsProps {
  issueId: string;
  workspaceId: string;
  currentUserId: string;
}

export function IssueComments({ issueId, workspaceId, currentUserId }: IssueCommentsProps) {
  const router = useRouter();
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    async function loadComments() {
      try {
        const data = await getIssueComments(issueId, workspaceId);
        setComments(data);
      } catch {
        // Silently fail, will show empty state
      } finally {
        setIsLoading(false);
      }
    }
    loadComments();
  }, [issueId]);

  async function handleSubmitComment() {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await createComment({
        issueId,
        body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: newComment.trim() }] }] },
      });

      if (result.success) {
        setNewComment("");
        router.refresh();
        // Reload comments
        const data = await getIssueComments(issueId, workspaceId);
        setComments(data);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to post comment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateComment(commentId: string) {
    if (!editContent.trim()) return;

    const result = await updateComment({
      id: commentId,
      body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: editContent.trim() }] }] },
    });

    if (result.success) {
      setEditingId(null);
      const data = await getIssueComments(issueId, workspaceId);
      setComments(data);
    } else {
      toast.error(result.error);
    }
  }

  async function handleDeleteComment() {
    if (!deleteId) return;

    const result = await deleteComment({ id: deleteId });
    if (result.success) {
      setDeleteId(null);
      const data = await getIssueComments(issueId, workspaceId);
      setComments(data);
    } else {
      toast.error(result.error);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {comments.length === 0 && (
        <div data-testid="empty-comments-state" className="py-8 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No comments yet. Be the first to comment.
          </p>
        </div>
      )}

      {/* Comment List */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} data-testid="comment-item" className="group flex gap-3">
            <UserAvatar name={comment.author.name} image={comment.author.image} size="sm" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{comment.author.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeDate(comment.createdAt)}
                </span>
                {comment.createdAt.toString() !== comment.updatedAt.toString() && (
                  <span data-testid="comment-edited-label" className="text-xs text-muted-foreground">(edited)</span>
                )}
              </div>

              {editingId === comment.id ? (
                <div className="mt-1">
                  <textarea
                    data-testid="comment-edit-editor"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={2}
                  />
                  <div className="mt-1 flex gap-2">
                    <button
                      data-testid="comment-save-button"
                      onClick={() => handleUpdateComment(comment.id)}
                      className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Save
                    </button>
                    <button
                      data-testid="comment-cancel-button"
                      onClick={() => setEditingId(null)}
                      className="rounded border px-3 py-1 text-xs font-medium hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-sm">
                  {typeof comment.body === "string" ? comment.body : comment.bodyText || "Comment"}
                </div>
              )}

              {/* Edit / Delete buttons (shown for comment author) */}
              {comment.authorId === currentUserId && editingId !== comment.id && (
                <div className="mt-1 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    data-testid="comment-edit-button"
                    onClick={() => {
                      setEditingId(comment.id);
                      setEditContent(comment.bodyText || "");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    data-testid="comment-delete-button"
                    onClick={() => setDeleteId(comment.id)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* New Comment */}
      <div className="mt-4 border-t pt-4">
        <textarea
          data-testid="comment-editor"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          aria-label="Write a comment"
          placeholder="Write a comment..."
          rows={3}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-2 flex justify-end">
          <button
            data-testid="comment-submit-button"
            onClick={handleSubmitComment}
            disabled={isSubmitting || !newComment.trim()}
            aria-disabled={!newComment.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Comment
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteComment}
        title="Delete this comment?"
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        data-testid="confirm-delete-dialog"
      />
    </div>
  );
}
