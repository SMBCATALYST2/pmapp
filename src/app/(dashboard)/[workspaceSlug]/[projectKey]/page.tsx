import { redirect } from "next/navigation";

interface ProjectPageProps {
  params: Promise<{ workspaceSlug: string; projectKey: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { workspaceSlug, projectKey } = await params;
  redirect(`/${workspaceSlug}/${projectKey}/board`);
}
