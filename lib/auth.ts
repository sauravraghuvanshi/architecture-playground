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
import { getPrisma } from "@/lib/prisma";

const isAuthEnabled = Boolean(process.env.AUTH_SECRET && process.env.GITHUB_ID);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: isAuthEnabled ? PrismaAdapter(getPrisma()) : undefined,
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
