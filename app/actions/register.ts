"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function registerUser(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password || !name) {
    return { error: "All account parameters must be completed." };
  }
  try {
    // 1. Check for duplicates
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return { error: "Email is already registered." };

    // 2. Encrypt the password string
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Insert user and award them 1000 starting bank point credits automatically!
    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "USER",
        },
         });

      // System mints starting credits balance ledger line
      await tx.transaction.create({
        data: {
          amount: 100000,
          description: "Sign-up Promo Account Credits",
          receiverId: newUser.id,
        },
      });
    });

    return { success: true };
    } catch (err) {
    return { error: "An unexpected account processing failure occurred." };
  }
}