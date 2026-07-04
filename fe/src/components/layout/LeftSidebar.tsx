import Link from "next/link";
import { Home, TrendingUp, Newspaper, Mail, User } from "lucide-react";
import { auth } from "@/auth";

export async function LeftSidebar() {
  const session = await auth();

  return (
    <aside className="hidden sm:flex flex-col w-20 xl:w-64 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto p-4">
      <nav className="flex flex-col gap-2">
        <Link href="/" className="flex items-center gap-4 p-3 w-fit rounded-full hover:bg-accent transition">
          <Home className="w-6 h-6" />
          <span className="text-xl hidden xl:block">Home</span>
        </Link>
        <Link href="/trending" className="flex items-center gap-4 p-3 w-fit rounded-full hover:bg-accent transition">
          <TrendingUp className="w-6 h-6" />
          <span className="text-xl hidden xl:block">Trending</span>
        </Link>
        <Link href="/news" className="flex items-center gap-4 p-3 w-fit rounded-full hover:bg-accent transition">
          <Newspaper className="w-6 h-6" />
          <span className="text-xl hidden xl:block">News</span>
        </Link>
        <Link href="/messages" className="flex items-center gap-4 p-3 w-fit rounded-full hover:bg-accent transition">
          <Mail className="w-6 h-6" />
          <span className="text-xl hidden xl:block">Messages</span>
        </Link>
        <Link href="/premium" className="flex items-center gap-4 p-3 w-fit rounded-full hover:bg-accent transition">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>
          <span className="text-xl hidden xl:block">Premium</span>
        </Link>
        <Link href={`/${(session?.user as any)?.username || 'profile'}`} className="flex items-center gap-4 p-3 w-fit rounded-full hover:bg-accent transition">
          <User className="w-6 h-6" />
          <span className="text-xl hidden xl:block">Profile</span>
        </Link>
      </nav>
    </aside>
  );
}
