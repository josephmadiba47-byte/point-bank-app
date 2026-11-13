"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$';

async function verifyAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized.");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") {
    throw new Error("Forbidden: Admin privileges required.");
  }
}

export async function adminCreateUser(formData: FormData) {
  try {
    await verifyAdmin();

    const name = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim();
    const password = formData.get("password") as string;
    const role = (formData.get("role") as string) || "USER";
    const initialDepositStr = (formData.get("initialDeposit") as string) || "0";

    if (!name || !email || !password) {
      return { error: "Name, email, and password are required." };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "An account with this email already exists." };

    const hashedPassword = await bcrypt.hash(password, 10);
    const initialUnits = Math.round(parseFloat(initialDepositStr) * 100);

    await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name, email, password: hashedPassword, role },
      });

      if (!isNaN(initialUnits) && initialUnits > 0) {
        await tx.transaction.create({
          data: {
            amount: initialUnits,
            description: "Admin Initial Account Funding",
            receiverId: created.id,
          },
        });
      }
    });

    revalidatePath("/admin");
    return { success: `Account created for ${name} (${email}).` };
  } catch (err: any) {
    return { error: err.message || "Failed to create account." };
  }
}

export async function adminMintCredits(userId: string, amountStr: string, memo: string) {
  try {
    await verifyAdmin();

    const amount = Math.round(parseFloat(amountStr) * 100);
    if (isNaN(amount) || amount <= 0) {
      return { error: "Enter a valid credit amount greater than zero." };
    }

    await prisma.transaction.create({
      data: {
        amount,
        description: memo.trim() || "",
        receiverId: userId,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { success: `Minted ${formatCurrency((amount / 100), currency)} successfully.` };
  } catch (err: any) {
    return { error: err.message || "Failed to mint credits." };
  }
}

export async function adminGenerateAuthCode(txId: string) {
  try {
    await verifyAdmin();

    const newPin = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.transaction.update({
      where: { id: txId },
      data: { authCode: newPin },
    });

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { success: true, code: newPin };
  } catch (err: any) {
    return { error: err.message || "Failed to generate code." };
  }
}

export async function adminToggleSuspend(targetUserId: string, currentStatus: boolean) {
  try {
    await verifyAdmin();

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true, name: true },
    });

    if (!target) return { error: "User not found." };
    if (target.role === "ADMIN") {
      return { error: "Cannot suspend an administrator account." };
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { isSuspended: !currentStatus },
    });

    revalidatePath("/admin");
    return {
      success: !currentStatus
        ? `Account for ${target.name} has been frozen.`
        : `Account for ${target.name} has been restored.`,
    };
  } catch (err: any) {
    return { error: err.message || "Failed to update account status." };
  }
}


