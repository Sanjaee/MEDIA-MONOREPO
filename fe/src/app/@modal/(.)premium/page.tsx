import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PremiumModal } from "@/components/premium/PremiumModal";

export default async function PremiumModalInterceptedPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const userName = session.user.name || "User";

  return <PremiumModal userName={userName} />;
}
