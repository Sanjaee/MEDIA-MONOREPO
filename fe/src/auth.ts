import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { GoAdapter } from "@/lib/go-adapter"
import { SignJWT } from "jose"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default_secret_for_dev_only"
);

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

        // Sign a JWT for the backend
        const token = await new SignJWT({
          sub: user.id,
          iss: "media-api",
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("24h")
          .sign(JWT_SECRET);
          
        session.user.id = token; // Inject JWT token here so all actions pick it up automatically
      }
      return session;
    }
  },
  ...authConfig,
})