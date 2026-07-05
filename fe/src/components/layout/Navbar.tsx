import Link from "next/link"
import Image from "next/image"
import { auth } from "@/auth"
import { SignInButton } from "@/components/auth/SignInButton"
import { UserDropdown } from "@/components/auth/UserDropdown"
import { NavbarSearch } from "@/components/layout/NavbarSearch"
import { NotificationDropdown } from "@/components/layout/NotificationDropdown"
import { CreatePostModal } from "@/components/feed/CreatePostModal"

export async function Navbar() {
  const session = await auth()

  return (
    <header className="sticky top-0 z-50 w-full bg-gray-800 dark:bg-gray-900 border-b border-gray-700">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4 min-w-fit">
          <Link href="/" className="flex items-center space-x-2">
            <Image src="/logo.png" alt="MediaApp" width={32} height={32} className="rounded-md object-contain" />
          </Link>
        </div>
        
        <div className="flex flex-1 max-w-2xl mx-2 md:mx-4 items-center gap-2">
          <NavbarSearch />
          <div className="hidden md:block">
            {session?.user && <CreatePostModal />}
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 md:gap-4 min-w-fit">
          {session?.user ? (
            <>
              <NotificationDropdown />
              <UserDropdown user={session.user} />
            </>
          ) : (
            <SignInButton />
          )}
        </div>
      </div>
    </header>
  )
}
