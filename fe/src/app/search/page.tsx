import { getSearchFeedAction } from "@/actions/feed.actions";
import { searchUsersAction } from "@/actions/user.actions";
import { SearchTabsWrapper } from "@/components/search/SearchTabsWrapper";
import { Search } from "lucide-react";

export const revalidate = 0; // Disable caching

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedParams = await searchParams;
  const q = resolvedParams.q || "";
  
  const initialData = await getSearchFeedAction({ q, limit: 10 });
  const initialUsers = await searchUsersAction(q);

  return (
    <main className="flex w-full max-w-2xl flex-col border-x min-h-screen">
      <div className="sticky top-0 z-10 flex items-center gap-4 bg-background/80 px-4 py-3 backdrop-blur-md border-b">
        <Search className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">Search Results</h1>
      </div>

      <SearchTabsWrapper 
        q={q} 
        initialData={initialData} 
        initialUsers={initialUsers} 
      />
    </main>
  );
}
