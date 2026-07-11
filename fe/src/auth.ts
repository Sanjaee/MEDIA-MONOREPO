import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { GoAdapter } from "@/lib/go-adapter"

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  adapter: GoAdapter(),
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // @ts-ignore - append custom fields
        session.user.role = (user as any).role || (user as any).Role || "member";
        // @ts-ignore
        session.user.username = (user as any).username || (user as any).Username;
      }
      return session;
    }
  },
  ...authConfig,
})