"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { MemberWithUser } from "@/types";
import { changeMemberRole, removeMember } from "@/server/actions/workspace-actions";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatRelativeDate } from "@/lib/utils";

interface MembersTableProps {
  members: MemberWithUser[];
  workspaceId: string;
  currentUserId: string;
}

export function MembersTable({ members, workspaceId, currentUserId }: MembersTableProps) {
  const router = useRouter();
  const [removeTarget, setRemoveTarget] = useState<MemberWithUser | null>(null);

  async function handleRoleChange(userId: string, newRole: string) {
    const result = await changeMemberRole({
      workspaceId,
      userId,
      role: newRole as "ADMIN" | "MEMBER" | "VIEWER",
    });

    if (result.success) {
      toast.success("Role updated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;

    const result = await removeMember({
      workspaceId,
      userId: removeTarget.userId,
    });

    if (result.success) {
      toast.success(`${removeTarget.user.name || removeTarget.user.email} has been removed from the workspace.`);
      setRemoveTarget(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <div className="rounded-lg border">
        <table data-testid="members-table" className="w-full" aria-label="Workspace members">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Member</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Joined</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isSelf = member.userId === currentUserId;
              const isOwner = member.role === "OWNER";
              const userName = member.user.name?.toLowerCase().replace(/\s+/g, "-") || member.user.email;

              return (
                <tr
                  key={member.userId}
                  data-testid={`member-row-${userName}`}
                  className="border-b last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={member.user.name} image={member.user.image} size="md" />
                      <div>
                        <p className="text-sm font-medium">{member.user.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{member.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isOwner || isSelf ? (
                      <span
                        data-testid={isSelf ? "role-select-self" : undefined}
                        className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                      >
                        {member.role}
                      </span>
                    ) : (
                      <select
                        data-testid={`role-select-${userName}`}
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                        className="rounded border bg-background px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Member</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatRelativeDate(member.joinedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isOwner && !isSelf && (
                      <button
                        data-testid={`remove-member-button-${userName}`}
                        onClick={() => setRemoveTarget(member)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title={`Remove ${removeTarget?.user.name || "member"} from workspace?`}
        description="They will be unassigned from all issues."
        confirmLabel="Remove"
        variant="destructive"
        data-testid="confirm-remove-dialog"
      />
    </>
  );
}
