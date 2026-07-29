"use client";

import Link from "next/link";
import { UserNameWithRole } from "@/components/ui/UserNameWithRole";

export function UserSearchFeed({ q, initialUsers }: { q: string; initialUsers: any[] }) {
  if (!initialUsers || initialUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p>No users found for "{q}"</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {initialUsers.map((user) => (
        <Link href={`/${user.username}`} key={user.username} className="block group border-b">
          <div className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
            <img 
              src={user.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
              alt={user.username} 
              className="w-12 h-12 rounded-full bg-background border object-cover" 
            />
            <div className="flex flex-col flex-1 min-w-0">
              <UserNameWithRole 
                displayName={user.name || user.username}
                role={user.role}
                className="text-base"
              />
              <span className="text-sm text-muted-foreground truncate">@{user.username}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
