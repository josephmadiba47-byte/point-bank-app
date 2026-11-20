"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserBalance } from "@/lib/ledger";
import { revalidatePath } from "next/cache";

const EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

export async function requestTransfer(
  recipientName: string,
  recipientAccountNo: string,
  recipientSystemName: string,
  routingNumber: string,
  amountStr: string,
  description: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expired. Please log in again." };

  const senderId = session.user.id;

  const sender = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuspended: true },
  });
  if (sender?.isSuspended) {
    return { error: "Your account is currently frozen. Outgoing wires are disabled." };
  }
  
  const existingPending = await prisma.transaction.findFirst({
    where: { senderId, authCode: { not: null } },
  });
  if (existingPending) {
    return { error: "You have a pending transfer. Complete or cancel it from your history first." };
  }

  if (
    !recipientName?.trim() ||
    !recipientAccountNo?.trim() ||
    !recipientSystemName?.trim() ||
    !routingNumber?.trim()
  ) {
    return { error: "All external recipient and routing fields are required." };
  }

  const amount = Math.round(parseFloat(amountStr) * 100);
  if (isNaN(amount) || amount <= 0) return { error: "Amount must be greater than zero." };

  const balance = await getUserBalance(senderId);
  if (balance < amount) return { error: "Insufficient balance." };

  const pinCode = Math.floor(100000 + Math.random() * 900000).toString();

  const pendingTx = await prisma.transaction.create({
    data: {
      senderId,
      recipientName: recipientName.trim(),
      recipientAccountNo: recipientAccountNo.trim(),
      recipientSystemName: recipientSystemName.trim(),
      routingNumber: routingNumber.trim(),
      amount,
      description: description.trim() || "External Vault Wire",
      authCode: pinCode,
    },
  });

  revalidatePath("/dashboard");
  return { success: true, txId: pendingTx.id, debugPin: pinCode };
}

export async function confirmTransfer(txId: string, inputCode: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };
  const userId = session.user.id;

  const sender = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuspended: true },
  });
  if (sender?.isSuspended) {
    return { error: "Your account is currently frozen. Outgoing wires are disabled." };
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const pendingTx = await tx.transaction.findUnique({ where: { id: txId } });

      if (!pendingTx || !pendingTx.authCode || pendingTx.senderId !== userId) {
        throw new Error("Transaction not found or already completed.");
      }

      if (pendingTx.authCode !== inputCode.trim()) {
        throw new Error("Invalid security verification code.");
      }

      const balance = await getUserBalance(userId);
      if (balance < pendingTx.amount) {
        throw new Error("Insufficient balance to complete this transfer.");
      }

      await tx.transaction.update({
        where: { id: txId },
        data: { authCode: null },
      });

      return { success: "Ledger transaction signed and completed!" };
    });
  } catch (error: any) {
    return { error: error.message || "Authorization failed." };
  } finally {
    revalidatePath("/dashboard");
  }
}

export async function cancelTransfer(txId: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.transaction.deleteMany({
    where: { id: txId, senderId: session.user.id, authCode: { not: null } },
  });

  revalidatePath("/dashboard");
}


export async function regenerateTransferCode(txId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  const newPin = Math.floor(100000 + Math.random() * 900000).toString();

  await prisma.transaction.updateMany({
    where: { id: txId, senderId: session.user.id, authCode: { not: null } },
    data: { authCode: newPin, createdAt: new Date() }, // Resets the 5-minute window
  });

  revalidatePath("/dashboard");
  return { success: true, debugPin: newPin };
}
