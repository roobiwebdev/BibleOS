"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: SignOutButton, sign out, logout button
 * WHAT:  Button that signs the user out and returns to the home page.
 * WHERE: maintenance page and any screen that needs a standalone sign-out.
 */

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@starter/ui/components/button";

export function SignOutButton({
  variant = "outline",
  size = "sm",
  children = "Sign out",
}: {
  variant?: "outline" | "default" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon" | "xs" | "icon-xs";
  children?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => {
        authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/");
              router.refresh();
            },
          },
        });
      }}
    >
      {children}
    </Button>
  );
}
