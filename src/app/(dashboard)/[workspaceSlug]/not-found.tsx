import Link from "next/link";
import { FolderOpen } from "lucide-react";

export default function WorkspaceNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <FolderOpen className="h-16 w-16 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Workspace not found</h2>
      <p className="text-sm text-muted-foreground">
        This workspace doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
