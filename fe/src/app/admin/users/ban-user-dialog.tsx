"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { banUserAction } from "@/actions/admin.actions";
import { toast } from "sonner";
import { Ban } from "lucide-react";

export function BanUserDialog({ 
  userId, 
  username, 
  isBanned, 
  open,
  onOpenChange
}: { 
  userId: string; 
  username: string; 
  isBanned: boolean; 
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("0");
  const queryClient = useQueryClient();

  const isControlled = open !== undefined && onOpenChange !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? onOpenChange : setInternalOpen;

  const mutation = useMutation({
    mutationFn: async () => {
      await banUserAction(userId, reason, parseInt(duration, 10));
    },
    onSuccess: () => {
      toast.success("User banned successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDialogOpen(false);
      setReason("");
      setDuration("0");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to ban user");
    },
  });

  if (isBanned && !isControlled) {
    return <Button variant="destructive" size="sm" disabled>Banned</Button>;
  }

  return (
    <>
      {!isControlled && (
        <Button variant="destructive" size="sm" onClick={() => setDialogOpen(true)}>
          <Ban className="w-4 h-4 mr-2" /> Ban User
        </Button>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Ban {username}</DialogTitle>
            <DialogDescription>
              Specify the reason and duration for banning this user. They will immediately lose access to the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Violation of terms..."
                className="w-full min-h-[100px] resize-none"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duration">Duration</Label>
              <Select value={duration} onValueChange={(val) => setDuration(val || "0")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Day</SelectItem>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="0">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => mutation.mutate()} 
              disabled={!reason.trim() || mutation.isPending}
            >
              {mutation.isPending ? "Banning..." : "Confirm Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
