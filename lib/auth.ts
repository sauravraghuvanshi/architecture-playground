/**
 * Auth.js (NextAuth v5) configuration.
 * Providers: GitHub (primary), more can be added later.
 *
 * Auth is optional — if AUTH_SECRET / GITHUB_ID aren't set, the app
 * still works as a guest-only playground with localStorage persistence.
 */
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";

const isAuthEnabled = Boolean(process.env.AUTH_SECRET && process.env.GITHUB_ID);

function getAdapter() {
  if (!isAuthEnabled) return undefined;
  // Lazy-load Prisma only when auth is actually enabled at runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getPrisma } = require("@/lib/prisma");
  return PrismaAdapter(getPrisma());
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: getAdapter(),
  providers: isAuthEnabled
    ? [
        GitHub({
          clientId: process.env.GITHUB_ID,
          clientSecret: process.env.GITHUB_SECRET,
        }),
      ]
    : [],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
