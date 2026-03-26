import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { getProjectByKey } from "@/server/queries/project";
import { getWorkspaceBySlug } from "@/server/queries/workspace";
import { ProjectSubNav } from "@/components/layout/project-sub-nav";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string; projectKey: string }>;
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { workspaceSlug, projectKey } = await params;
  const session = await auth();
  if (!session?.user?.id) return notFound();

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) return notFound();

  const project = await getProjectByKey(workspace.id, projectKey);
  if (!project) return notFound();

  return (
    <div className="flex h-full flex-col">
      <div data-testid="project-header" className="border-b px-6 pt-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: project.color || "#6366F1" }}
          >
            {project.icon || project.name.charAt(0)}
          </span>
          <h1 className="text-lg font-semibold">{project.name}</h1>
          <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {project.prefix}
          </span>
        </div>
        <ProjectSubNav
          workspaceSlug={workspaceSlug}
          projectKey={projectKey}
        />
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
