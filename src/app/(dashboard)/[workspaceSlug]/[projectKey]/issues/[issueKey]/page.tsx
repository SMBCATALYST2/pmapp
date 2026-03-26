import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/server/queries/workspace";
import { getIssueByKey } from "@/server/queries/issue";
import { getWorkspaceMembers } from "@/server/queries/member";
import { getLabels } from "@/server/queries/label";
import { IssueDetail } from "@/components/issues/issue-detail";

interface IssueDetailPageProps {
  params: Promise<{ workspaceSlug: string; projectKey: string; issueKey: string }>;
}

export default async function IssueDetailPage({ params }: IssueDetailPageProps) {
  const { workspaceSlug, projectKey, issueKey } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();

  const [issue, members, labels] = await Promise.all([
    getIssueByKey(workspace.id, issueKey),
    getWorkspaceMembers(workspace.id),
    getLabels(workspace.id),
  ]);

  if (!issue) notFound();

  return (
    <IssueDetail
      issue={issue}
      members={members}
      labels={labels}
      workspaceSlug={workspaceSlug}
      projectKey={projectKey}
      currentUserId={session.user.id}
    />
  );
}
