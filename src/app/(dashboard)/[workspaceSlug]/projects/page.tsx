import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/server/queries/workspace";
import { getProjects } from "@/server/queries/project";
import { ProjectCard } from "@/components/projects/project-card";
import { EmptyState } from "@/components/shared/empty-state";
import { FolderKanban, Plus } from "lucide-react";
import Link from "next/link";

interface ProjectsPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function ProjectsPage({ params }: ProjectsPageProps) {
  const { workspaceSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/");

  const projects = await getProjects(workspace.id);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage your team&apos;s projects
          </p>
        </div>
        <Link
          href={`/${workspaceSlug}/projects/new`}
          data-testid="create-project-button"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          data-testid="empty-projects-state"
          icon={FolderKanban}
          heading="Create your first project"
          description="Get started by creating a project to organize your issues."
          actionLabel="New project"
          actionHref={`/${workspaceSlug}/projects/new`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
