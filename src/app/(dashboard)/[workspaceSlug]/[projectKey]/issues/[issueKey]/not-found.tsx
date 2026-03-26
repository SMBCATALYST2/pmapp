import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function IssueNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <AlertCircle className="h-16 w-16 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Issue not found</h2>
      <p className="text-sm text-muted-foreground">
        This issue doesn&apos;t exist or has been deleted.
      </p>
      <Link
        href="../board"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Back to board
      </Link>
    </div>
  );
}
