"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: UserMenu, account dropdown, sign out, send feedback, public header menu
 * WHAT:  Account dropdown for the public header: email, feedback, sign out (or a Sign In button).
 * WHERE: components/header.tsx.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@starter/ui/components/dropdown-menu";
import { authClient } from "@/lib/auth-client";

import { Button } from "@starter/ui/components/button";
import { Skeleton } from "@starter/ui/components/skeleton";

import { FeedbackDialog } from "./feedback-dialog";

export default function UserMenu() {
  const router = useRouter();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Link href="/login">
        <Button variant="outline">Sign In</Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>{session.user.name}</DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{session.user.email}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Send Feedback
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    router.push("/");
                  },
                },
              });
            }}
          >
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </DropdownMenu>
  );
}
