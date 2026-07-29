"use client";

import { useSession, signOut } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertOctagon } from "lucide-react";

export function GlobalBanDialog() {
  const { data: session } = useSession();

  const isBanned = (session?.user as any)?.isBanned === true;
  const reason = (session?.user as any)?.banReason || "No reason provided";
  const bannedUntil = (session?.user as any)?.bannedUntil;

  let expirationText = "Permanently";
  if (bannedUntil) {
    expirationText = `Until ${new Date(bannedUntil).toLocaleString()}`;
  }

  // If not banned, render nothing
  if (!isBanned) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px] border-destructive">
        <DialogHeader className="flex flex-col items-center justify-center space-y-2">
          <AlertOctagon className="w-12 h-12 text-destructive" />
          <DialogTitle className="text-xl">Account Suspended</DialogTitle>
          <DialogDescription className="text-center">
            Your account has been banned and you cannot access the platform.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted p-4 rounded-md space-y-2 text-sm mt-4">
          <div className="flex justify-between">
            <span className="font-medium">Reason:</span>
            <span className="text-muted-foreground break-words text-right max-w-[200px]">{reason}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Duration:</span>
            <span className="text-muted-foreground">{expirationText}</span>
          </div>
        </div>
        <DialogFooter className="mt-6 flex justify-center sm:justify-center">
          <Button 
            variant="default" 
            className="w-full"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
