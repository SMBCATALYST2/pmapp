import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/server/queries/workspace";
import { WorkspaceSettingsForm } from "@/components/workspace/workspace-settings-form";

interface SettingsPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function WorkspaceSettingsPage({ params }: SettingsPageProps) {
  const { workspaceSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Workspace Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your workspace configuration
      </p>
      <div className="mt-6">
        <WorkspaceSettingsForm workspace={workspace} />
      </div>
    </div>
  );
}
