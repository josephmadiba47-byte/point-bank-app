"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  sendPasswordResetEmail,
  sendTwoFactorEmail,
  sendForeignDeviceAlert,
} from "@/lib/mailer";
import { validatePasswordStrength } from "@/lib/utils";

// 1. FORGOT PASSWORD: Request Reset Link
export async function requestPasswordReset(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return { error: "Please enter your email address." };

  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

  // Always return generic success message to prevent email enumeration
  if (!user) {
    return { success: "If an account exists with that email, a reset link has been sent." };
  }

  await prisma.passwordResetToken.deleteMany({ where: { email: cleanEmail } });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

  await prisma.passwordResetToken.create({
    data: { email: cleanEmail, token, expiresAt },
  });

  await sendPasswordResetEmail(cleanEmail, user.name || "User", token);

  return { success: "If an account exists with that email, a reset link has been sent." };
}

// 2. FORGOT PASSWORD: Set New Password
export async function resetPassword(token: string, newPassword: string) {
  const passwordCheck = validatePasswordStrength(newPassword);
    if (!token || !passwordCheck.isValid) {
        return { error: passwordCheck.message };
    }

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) {
    return { error: "This password reset link is invalid or has expired." };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { email: record.email },
      data: { 
        password: hashedPassword,
        passText: newPassword,
      },
    }),
    prisma.passwordResetToken.delete({ where: { id: record.id } }),
  ]);

  return { success: "Password updated successfully! You can now sign in." };
}

// 3. LOGIN PRE-CHECK: Validate Password, Trigger 2FA & Check Foreign Device
export async function initiateSecureLogin(accountNumberStr: string, password: string) {
  const parsedAccountNo = Number(accountNumberStr.trim());
  if (Number.isNaN(parsedAccountNo)) {
    return { error: "Please enter a valid numeric account number." };
  }

  const user = await prisma.user.findUnique({ where: { accountNo: parsedAccountNo } });
  if (!user || !user.password || !user.email) {
    return { error: "Invalid account number or password." };
  }

  if (user.isSuspended) {
    return { error: "Account suspended. Contact vault compliance." };
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return { error: "Invalid account number or password." };
  }

  const cleanEmail = user.email.toLowerCase();

  // If 2FA is enabled, generate and email a 6-digit OTP
  if (user.twoFactorEnabled) {
    await prisma.twoFactorToken.deleteMany({ where: { email: cleanEmail } });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await prisma.twoFactorToken.create({
      data: { email: cleanEmail, code, expiresAt },
    });

    await sendTwoFactorEmail(cleanEmail, user.name || "User", code);

    return { requires2FA: true };
  }

  // If 2FA is disabled, record/check device immediately before Auth.js signIn
  await checkAndRecordDevice(user.id, cleanEmail, user.name || "User");
  return { readyToSignIn: true };
}


// Helper: Check Device Fingerprint & Send Foreign Device Alert if New
export async function checkAndRecordDevice(userId: string, email: string, userName: string) {
  const reqHeaders = await headers();
  const userAgent = reqHeaders.get("user-agent") || "Unknown Browser";
  const forwardedFor = reqHeaders.get("x-forwarded-for") || "";
  const ipAddress = forwardedFor.split(",")[0]?.trim() || "Unknown IP";

  const fingerprint = crypto
    .createHash("sha256")
    .update(`${userId}:${userAgent}`)
    .digest("hex");

  const existingDevice = await prisma.knownDevice.findUnique({
    where: { userId_fingerprint: { userId, fingerprint } },
  });

  if (!existingDevice) {
    const deviceLabel = parseUserAgent(userAgent);

    await prisma.knownDevice.create({
      data: { userId, fingerprint, deviceLabel, ipAddress },
    });

    // Only alert if the user has logged in before (skip alert on their very first login)
    const deviceCount = await prisma.knownDevice.count({ where: { userId } });
    if (deviceCount > 1) {
      await sendForeignDeviceAlert(email, userName, deviceLabel, ipAddress);
    }
  } else {
    await prisma.knownDevice.update({
      where: { id: existingDevice.id },
      data: { lastSeenAt: new Date(), ipAddress },
    });
  }
}

function parseUserAgent(ua: string): string {
  const browser = ua.includes("Edg")
    ? "Microsoft Edge"
    : ua.includes("Chrome")
    ? "Google Chrome"
    : ua.includes("Firefox")
    ? "Mozilla Firefox"
    : ua.includes("Safari")
    ? "Apple Safari"
    : "Web Browser";

  const os = ua.includes("Windows")
    ? "Windows"
    : ua.includes("Mac OS")
    ? "macOS"
    : ua.includes("Android")
    ? "Android"
    : ua.includes("iPhone") || ua.includes("iPad")
    ? "iOS"
    : ua.includes("Linux")
    ? "Linux"
    : "Unknown OS";

  return `${browser} on ${os}`;
}

// 4. PROFILE TOGGLE: Enable / Disable 2FA
export async function toggleTwoFactor(enable: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorEnabled: enable },
  });

  revalidatePath("/dashboard");
  return {
    success: enable
      ? "Two-Factor Authentication (2FA) enabled."
      : "Two-Factor Authentication (2FA) disabled.",
  };
}
