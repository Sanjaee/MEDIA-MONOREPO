import { getPostById } from "@/actions/post.actions";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: {
    postId: string;
  };
}

export default async function PostRedirectPage({ params }: PageProps) {
  const { postId } = await params;
  
  // Fetch the post to find out who the author is
  const post = await getPostById(postId);
  
  if (!post || !post.author || !post.author.username) {
    notFound();
  }

  // Redirect to the correct URL format /username/status/postId
  redirect(`/${post.author.username}/status/${post.id}`);
}
