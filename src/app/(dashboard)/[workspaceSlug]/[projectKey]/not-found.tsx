import Link from "next/link";
import { FolderX } from "lucide-react";

export default function ProjectNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <FolderX className="h-16 w-16 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Project not found</h2>
      <p className="text-sm text-muted-foreground">
        This project doesn&apos;t exist or has been deleted.
      </p>
      <Link
        href=".."
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Back to projects
      </Link>
    </div>
  );
}
