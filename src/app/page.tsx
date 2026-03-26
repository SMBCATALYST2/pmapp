import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { getUserWorkspaces } from "@/server/queries/workspace";

/**
 * Root page: redirects authenticated users to their workspace,
 * unauthenticated users to sign-in.
 */
export default async function RootPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  // Resolve workspace and redirect directly (avoids /dashboard redirect loop)
  const workspaces = await getUserWorkspaces();

  if (workspaces.length === 0) {
    redirect("/create-workspace");
  }

  redirect(`/${workspaces[0]!.slug}/projects`);
}
