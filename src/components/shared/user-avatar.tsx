import { cn, getInitials } from "@/lib/utils";

interface UserAvatarProps {
  name: string | null;
  image: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

export function UserAvatar({ name, image, size = "md", className }: UserAvatarProps) {
  if (image) {
    return (
      <img
        src={image}
        alt={name || "User avatar"}
        className={cn("rounded-full object-cover", sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-primary font-medium text-primary-foreground",
        sizeClasses[size],
        className
      )}
      aria-label={name || "User avatar"}
    >
      {getInitials(name)}
    </div>
  );
}
