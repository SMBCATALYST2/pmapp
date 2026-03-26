import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/server/queries/workspace";
import { getBoardData } from "@/server/queries/project";
import { getWorkspaceMembers } from "@/server/queries/member";
import { getLabels } from "@/server/queries/label";
import { BoardView } from "@/components/boards/board-view";

interface BoardPageProps {
  params: Promise<{ workspaceSlug: string; projectKey: string }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { workspaceSlug, projectKey } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();

  const [boardData, members, labels] = await Promise.all([
    getBoardData(workspace.id, projectKey),
    getWorkspaceMembers(workspace.id),
    getLabels(workspace.id),
  ]);

  if (!boardData) notFound();

  return (
    <BoardView
      boardData={boardData}
      members={members}
      labels={labels}
      workspaceSlug={workspaceSlug}
      projectKey={projectKey}
    />
  );
}
