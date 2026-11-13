import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

// The matcher string optimizes performance by running the firewall filter 
// ONLY on specified application endpoints, completely ignoring static image/CSS assets
export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login"],
};
