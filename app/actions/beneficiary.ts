"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function saveBeneficiary(data: {
  accountName: string;
  accountNo: string;
  systemName: string;
  routingNo: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.beneficiary.upsert({
    where: {
      userId_accountNo_routingNo: {
        userId: session.user.id,
        accountNo: data.accountNo.trim(),
        routingNo: data.routingNo.trim(),
      },
    },
    update: {
      accountName: data.accountName.trim(),
      systemName: data.systemName.trim(),
    },
    create: {
      userId: session.user.id,
      accountName: data.accountName.trim(),
      accountNo: data.accountNo.trim(),
      systemName: data.systemName.trim(),
      routingNo: data.routingNo.trim(),
    },
  });

  revalidatePath("/dashboard");
}

export async function deleteBeneficiary(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.beneficiary.deleteMany({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/dashboard");
}
