"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { inviteMember } from "@/server/actions/workspace-actions";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});
type InviteInput = z.infer<typeof inviteSchema>;

interface InviteMemberDialogProps {
  workspaceId: string;
}

export function InviteMemberDialog({ workspaceId }: InviteMemberDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "MEMBER" },
  });

  async function onSubmit(data: InviteInput) {
    setServerError(null);
    const result = await inviteMember({
      workspaceId,
      email: data.email,
      role: data.role,
    });

    if (result.success) {
      toast.success(`Invitation sent to ${data.email}.`);
      reset();
      setOpen(false);
      router.refresh();
    } else {
      setServerError(result.error);
    }
  }

  return (
    <>
      <button
        data-testid="invite-member-button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
      >
        <UserPlus className="h-4 w-4" />
        Invite member
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            data-testid="invite-dialog"
            className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-lg"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Invite member</h2>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {serverError && (
                <div data-testid="invite-error" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  {serverError}
                </div>
              )}

              <div>
                <label htmlFor="invite-email" className="mb-1.5 block text-sm font-medium">
                  Email address
                </label>
                <input
                  id="invite-email"
                  data-testid="invite-email-input"
                  type="email"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="team@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="invite-role" className="mb-1.5 block text-sm font-medium">
                  Role
                </label>
                <select
                  id="invite-role"
                  data-testid="invite-role-select"
                  aria-label="Select role"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  {...register("role")}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="invite-submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
