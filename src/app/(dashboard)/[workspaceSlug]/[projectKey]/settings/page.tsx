import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/server/queries/workspace";
import { getProjectByKey } from "@/server/queries/project";
import { ProjectSettingsForm } from "@/components/projects/project-settings-form";

interface ProjectSettingsPageProps {
  params: Promise<{ workspaceSlug: string; projectKey: string }>;
}

export default async function ProjectSettingsPage({ params }: ProjectSettingsPageProps) {
  const { workspaceSlug, projectKey } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();

  const project = await getProjectByKey(workspace.id, projectKey);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="text-xl font-bold">Project Settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your project configuration
      </p>
      <div className="mt-6">
        <ProjectSettingsForm project={project} workspaceSlug={workspaceSlug} />
      </div>
    </div>
  );
}
