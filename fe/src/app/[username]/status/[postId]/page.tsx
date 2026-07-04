import { notFound } from "next/navigation";
import { getPostById } from "@/actions/post.actions";
import { PostCard } from "@/components/feed/PostCard";
import { CommentFeed } from "@/components/comment/CommentFeed";
import { BackButton } from "./BackButton";
import { ScrollToTop } from "@/components/ui/ScrollToTop";

interface PostPageProps {
  params: Promise<{
    username: string;
    postId: string;
  }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const resolvedParams = await params;
  const post = await getPostById(resolvedParams.postId);

  if (!post) {
    notFound();
  }
  
  const expectedUsername = post.author.username || 'user';
  if (expectedUsername !== resolvedParams.username) {
    notFound();
  }

  return (
    <div className="flex justify-center w-full min-h-screen bg-background text-foreground">
      <ScrollToTop />
      <main className="flex w-full max-w-2xl flex-col border-x min-h-screen">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-4 py-3 font-semibold flex items-center gap-6">
          <BackButton />
          Post
        </header>

        <PostCard post={post as any} priority={true} />
        <CommentFeed postId={post.id} />
      </main>
    </div>
  );
}
