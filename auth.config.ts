import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [], // Keep this empty here; full providers live in auth.ts
  pages: {
    signIn: "/login", // Route to bounce guests to
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isViewingDashboard = nextUrl.pathname.startsWith("/dashboard");

      if (isViewingDashboard) {
        if (isLoggedIn) return true;
        return false; // Blocks access and triggers redirect to /login
      } else if (isLoggedIn && nextUrl.pathname === "/login") {
        // If they are already logged in and try to visit the login page, 
        // instantly fast-forward them straight to the dashboard!
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      
      return true;
    },
  },
} satisfies NextAuthConfig;
