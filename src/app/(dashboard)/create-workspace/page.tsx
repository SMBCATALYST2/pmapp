"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";
import { createWorkspace } from "@/server/actions/workspace-actions";

const createWorkspaceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name too long"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(30, "Slug too long")
    .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, "Must start with a letter and contain only lowercase letters, numbers, and hyphens"),
  description: z.string().max(500, "Description too long").optional(),
});
type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export default function CreateWorkspacePage() {
  const router = useRouter();
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "error">("idle");
  const [slugError, setSlugError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: "", slug: "", description: "" },
  });

  const watchName = watch("name");
  const watchSlug = watch("slug");

  // Auto-generate slug from name
  useEffect(() => {
    if (watchName) {
      const generated = slugify(watchName);
      setValue("slug", generated, { shouldValidate: true });
    }
  }, [watchName, setValue]);

  // Debounced slug availability check
  useEffect(() => {
    if (!watchSlug || watchSlug.length < 2) {
      setSlugStatus("idle");
      return;
    }

    setSlugStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/workspaces/check-slug?slug=${encodeURIComponent(watchSlug)}`);
        const data = await res.json();
        if (data.available) {
          setSlugStatus("available");
          setSlugError(null);
        } else {
          setSlugStatus("error");
          setSlugError(data.reason || "This URL is already taken.");
        }
      } catch {
        setSlugStatus("error");
        setSlugError("Could not verify availability.");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [watchSlug]);

  async function onSubmit(data: CreateWorkspaceInput) {
    const result = await createWorkspace(data);
    if (result.success) {
      toast.success("Workspace created!");
      router.push(`/${data.slug}/projects`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold">Create your workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A workspace is your team&apos;s home for projects and issues.
        </p>

        <form
          data-testid="create-workspace-form"
          onSubmit={handleSubmit(onSubmit)}
          className="mt-6 space-y-4"
        >
          <div>
            <label htmlFor="workspace-name" className="mb-1.5 block text-sm font-medium">
              Workspace name
            </label>
            <input
              id="workspace-name"
              data-testid="workspace-name-input"
              type="text"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="My Team"
              {...register("name")}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-destructive" role="alert">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="workspace-slug" className="mb-1.5 block text-sm font-medium">
              Workspace URL
            </label>
            <div className="relative">
              <input
                id="workspace-slug"
                data-testid="workspace-slug-input"
                type="text"
                className="w-full rounded-lg border bg-background px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                {...register("slug")}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {slugStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {slugStatus === "available" && <Check data-testid="slug-status-available" className="h-4 w-4 text-green-500" />}
                {slugStatus === "error" && <X data-testid="slug-status-error" className="h-4 w-4 text-red-500" />}
              </div>
            </div>
            <p data-testid="slug-preview" className="mt-1 text-xs text-muted-foreground" aria-live="polite">
              pmapp.com/{watchSlug || "your-workspace"}
            </p>
            {(errors.slug || slugError) && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {errors.slug?.message || slugError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="workspace-desc" className="mb-1.5 block text-sm font-medium">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="workspace-desc"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder="What does your team work on?"
              {...register("description")}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || slugStatus === "checking"}
            aria-disabled={isSubmitting || slugStatus === "checking"}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create workspace
          </button>
        </form>
      </div>
    </div>
  );
}
