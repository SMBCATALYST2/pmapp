import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { getUserWorkspaces } from "@/server/queries/workspace";

/**
 * Dashboard home: redirect to first workspace or create-workspace.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const workspaces = await getUserWorkspaces();

  if (workspaces.length === 0) {
    redirect("/create-workspace");
  }

  // Redirect to first workspace projects page
  redirect(`/${workspaces[0]!.slug}/projects`);
}
