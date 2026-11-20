import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [], // Keep this empty here; full providers live in auth.ts
  pages: {
    signIn: "/login", // Route to bounce guests to
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtectedRoute =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/admin");

      if (isProtectedRoute) {
        if (isLoggedIn) return true;
        return false; // Blocks access and triggers redirect to /login
      } else if (isLoggedIn && nextUrl.pathname === "/login") {
        // Fast-forward logged-in users away from /login
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      // Allows /reset-password and any other public routes through cleanly
      return true;
    },
  },
} satisfies NextAuthConfig;
