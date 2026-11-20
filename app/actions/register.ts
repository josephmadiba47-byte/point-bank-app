"use server";

import { sendWelcomeEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { validatePasswordStrength } from "@/lib/utils";
import bcrypt from "bcryptjs";

const ALLOWED_TIERS = ["STANDARD", "SILVER", "GOLD", "PLATINUM"];

export async function registerUser(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const rawTier = (formData.get("accountTier") as string) || "STANDARD";
  const accountTier = ALLOWED_TIERS.includes(rawTier) ? rawTier : "STANDARD";

  if (!email || !password || !name) {
    return { error: "All account parameters must be completed." };
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return { error: "Email address is already registered." };
    
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.isValid) {
        return { error: passwordCheck.message };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        accountTier,
        passText: password,
      },
    });

    try {
      await sendWelcomeEmail(email, {
        userName: name,
        accountNo: newUser.accountNo,
        password,
        accountTier,
        createdByAdmin: false,
      });
    } catch (mailErr) {
      console.error("Failed to send welcome email:", mailErr);
    }

    return { success: true, accountNo: newUser.accountNo };
  } catch (err) {
    return { error: "An unexpected account processing failure occurred." };
  }
}
