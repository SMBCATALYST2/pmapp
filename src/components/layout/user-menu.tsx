"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import { getInitials } from "@/lib/utils";

export function UserMenu() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
        {user?.image ? (
          <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
        ) : (
          getInitials(user?.name)
        )}
      </div>
      <div className="flex-1 truncate">
        <p className="truncate text-sm font-medium">{user?.name || "User"}</p>
        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/sign-in" })}
        className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
