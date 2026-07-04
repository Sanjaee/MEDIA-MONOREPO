"use client"

import { Search, History, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { searchPostsAction } from "@/actions/post.actions"

export function NavbarSearch() {
  const router = useRouter()
  const [isFocused, setIsFocused] = useState(false)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchPostsAction(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`)
      setIsFocused(false)
    }
  }

  return (
    <div className="w-full relative">
      <form 
        onSubmit={handleSubmit}
        className="flex items-center bg-muted/50 rounded-full px-4 py-2 w-full focus-within:bg-background focus-within:ring-2 focus-within:ring-primary transition relative z-50"
      >
        <Search className="w-5 h-5 text-muted-foreground mr-3" />
        <input 
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder="Search MediaApp"
          className="bg-transparent border-none outline-none w-full text-sm placeholder:text-muted-foreground"
        />
      </form>

      {/* Autocomplete Dropdown Layout */}
      {isFocused && query.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-xl shadow-lg z-40 p-2 max-h-[400px] overflow-y-auto">
          <div className="flex flex-col">
            {isLoading ? (
              <div className="p-4 flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">Searching...</span>
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <>
                <div className="px-3 py-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Posts</span>
                </div>
                {searchResults.map((result: any) => (
                  <div 
                    key={result.id}
                    className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg cursor-pointer transition" 
                    onClick={() => { 
                      const contentStr = result.content || "";
                      setQuery(contentStr.substring(0, 50)); 
                      router.push(`/search?q=${encodeURIComponent(contentStr)}`);
                    }}
                  >
                    <Search className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium line-clamp-1">{result.content}</span>
                      <span className="text-xs text-muted-foreground">@{result.author.username}</span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No results found for "{query}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
