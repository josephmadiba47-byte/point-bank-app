import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config"; // <-- IMPORT THE NEW CONFIG

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig, // <-- SPREAD THE CONFIG RULES HERE
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        accountNumber: { label: "Account Number", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.accountNumber || !credentials?.password) return null;

        const accountNumber = Number(credentials.accountNumber);

        if (Number.isNaN(accountNumber)) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { accountNo: accountNumber },
        });

        if (!user || !user.password) {
          throw new Error("No account found with this account number.");
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValidPassword) {
          throw new Error("Incorrect account credentials password.");
        }
        if (user.isSuspended) {
          throw new Error("Account suspended. Contact vault compliance.");
        }

        return { id: user.id, name: user.name, email: user.email, accountNumber: user.accountNo, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user){
        token.id = user.id;
        token.role = (user as any).role; 
      } 
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },
  },
});
