import { prisma } from "@/lib/prisma";

/**
 * Calculates the current real-time point balance of a user by summing the ledger.
 */

export async function getUserBalance(userId: string): Promise<number> {
  // 1. Only sum completed incoming credits (authCode is null)
  const totalReceived = await prisma.transaction.aggregate({
    where: {
      receiverId: userId,
      authCode: null,
    },
    _sum: { amount: true },
  });

  // 2. Only sum completed outgoing transfers (authCode is null)
  const totalSent = await prisma.transaction.aggregate({
    where: {
      senderId: userId,
      authCode: null,
    },
    _sum: { amount: true },
  });

  const received = totalReceived._sum.amount || 0;
  const sent = totalSent._sum.amount || 0;

  return received - sent;
}
