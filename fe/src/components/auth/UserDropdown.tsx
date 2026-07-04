"use client"

import Link from "next/link"
import { UserNameWithRole } from "@/components/ui/UserNameWithRole"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "next-auth/react"

interface UserDropdownProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export function UserDropdown({ user }: UserDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative h-8 w-8 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.image ?? ""} alt={user.name ?? "Avatar"} />
          <AvatarFallback>{user.name?.charAt(0) ?? "U"}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <div className="flex flex-col space-y-1 p-2">
          <UserNameWithRole 
            displayName={user.name || ""} 
            role={(user as any).role} 
            className="mb-0 text-sm" 
          />
          <p className="text-xs leading-none text-muted-foreground">
            {user.email}
          </p>
        </div>
        <DropdownMenuSeparator />
        {(user as any).role === "owner" && (
          <DropdownMenuItem>
            <Link href="/admin" className="w-full cursor-pointer font-bold text-primary">Dashboard</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem>
          <Link href={`/${(user as any).username || 'profile'}`} className="w-full cursor-pointer">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link href="/settings" className="w-full cursor-pointer">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
