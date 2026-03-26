import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { AcceptInviteClient } from "./accept-invite-client";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=/invite/${token}`);
  }

  return <AcceptInviteClient token={token} />;
}
