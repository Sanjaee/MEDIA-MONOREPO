import { cookies } from "next/headers";

export async function generateCsrfToken(): Promise<string> {
  const token = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("csrf_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return token;
}

export async function validateCsrfToken(tokenToValidate: string): Promise<boolean> {
  const cookieStore = await cookies();
  const storedToken = cookieStore.get("csrf_token")?.value;
  if (!storedToken || !tokenToValidate) {
    return false;
  }
  return storedToken === tokenToValidate;
}
