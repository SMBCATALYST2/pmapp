import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/server/queries/workspace";
import { getWorkspaceMembers } from "@/server/queries/member";
import { MembersTable } from "@/components/workspace/members-table";
import { InviteMemberDialog } from "@/components/workspace/invite-member-dialog";

interface MembersPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function MembersPage({ params }: MembersPageProps) {
  const { workspaceSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();

  const members = await getWorkspaceMembers(workspace.id);

  return (
    <div className="mx-auto max-w-4xl p-6" data-testid="members-page">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage workspace members and invitations
          </p>
        </div>
        <InviteMemberDialog workspaceId={workspace.id} />
      </div>

      {members.length <= 1 && (
        <div
          data-testid="invite-team-banner"
          className="mb-6 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 text-center"
        >
          <p className="text-sm font-medium">Invite your team</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start collaborating by inviting team members to your workspace.
          </p>
        </div>
      )}

      <MembersTable
        members={members}
        workspaceId={workspace.id}
        currentUserId={session.user.id}
      />
    </div>
  );
}
