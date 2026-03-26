import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/server/queries/workspace";
import { getProjectIssues } from "@/server/queries/issue";
import { getProjectByKey } from "@/server/queries/project";
import { getWorkspaceMembers } from "@/server/queries/member";
import { getLabels } from "@/server/queries/label";
import { IssuesDataTable } from "@/components/issues-table/issues-data-table";

interface ListPageProps {
  params: Promise<{ workspaceSlug: string; projectKey: string }>;
}

export default async function ListPage({ params }: ListPageProps) {
  const { workspaceSlug, projectKey } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();

  const project = await getProjectByKey(workspace.id, projectKey);
  if (!project) notFound();

  const [issuesData, members, labels] = await Promise.all([
    getProjectIssues(workspace.id, project.id),
    getWorkspaceMembers(workspace.id),
    getLabels(workspace.id),
  ]);

  const issues = issuesData;

  return (
    <div className="p-6">
      <IssuesDataTable
        issues={issues}
        members={members}
        labels={labels}
        statuses={project.statuses ?? []}
        workspaceSlug={workspaceSlug}
        projectKey={projectKey}
      />
    </div>
  );
}
