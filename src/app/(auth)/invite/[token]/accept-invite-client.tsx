"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { acceptInvite } from "@/server/actions/workspace-actions";

interface AcceptInviteClientProps {
  token: string;
}

export function AcceptInviteClient({ token }: AcceptInviteClientProps) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setIsAccepting(true);
    setError(null);
    try {
      const result = await acceptInvite(token);
      if (result.success) {
        toast.success("You have joined the workspace!");
        router.push(`/${result.data.workspaceSlug}/projects`);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm text-center">
      <h1 className="text-2xl font-bold">Workspace Invitation</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You have been invited to join a workspace.
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      <button
        onClick={handleAccept}
        disabled={isAccepting}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
      >
        {isAccepting && <Loader2 className="h-4 w-4 animate-spin" />}
        Accept invite
      </button>
    </div>
  );
}
