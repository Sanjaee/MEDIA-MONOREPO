import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Role-based protection: Only "owner" role can access the admin pages.
  if ((session?.user as any)?.role !== "owner") {
    redirect("/");
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-64px)] bg-background">
      {children}
    </div>
  );
}
