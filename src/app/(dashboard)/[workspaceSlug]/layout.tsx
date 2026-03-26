import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { getWorkspaceBySlug } from "@/server/queries/workspace";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { workspaceSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) return notFound();

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) return notFound();

  return <>{children}</>;
}
