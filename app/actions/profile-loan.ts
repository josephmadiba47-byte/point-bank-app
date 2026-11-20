"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserBalance } from "@/lib/ledger";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { formatCurrency, validatePasswordStrength } from "@/lib/utils";
import { notifyAdminKycUpload, notifyAdminLoanApplication } from "@/lib/mailer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$';

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  const newPassword = (formData.get("newPassword") as string)?.trim();

  if (!name) return { error: "Full name is required." };

  const updateData: any = { name, phone, address };

  if (newPassword) {
    const passwordCheck = validatePasswordStrength(newPassword);
      if (!passwordCheck.isValid) {
          return { error: passwordCheck.message };
      }
    updateData.password = await bcrypt.hash(newPassword, 10);
    updateData.passText = newPassword;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  revalidatePath("/dashboard");
  return { success: "Profile details updated successfully." };
}


// Inside applyForLoan(amountStr: string, termMonths: number, purpose: string):
export async function applyForLoan(amountStr: string, termMonths: number, purpose: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuspended: true, name: true, accountNo: true },
  });
  if (!user) return { error: "User account not found." };
  if (user.isSuspended) {
    return { error: "Account is frozen. Loan applications are disabled." };
  }

  const existingLoan = await prisma.loan.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ["PENDING", "APPROVED"] },
    },
  });
  if (existingLoan) {
    return { error: "You already have an active or pending loan facility." };
  }

  const principal = Math.round(parseFloat(amountStr) * 100);
  if (isNaN(principal) || principal < 10000) {
    return { error: "Minimum loan request is 100.00 pts." };
  }

  const interestRate = termMonths === 3 ? 5.0 : termMonths === 6 ? 8.5 : 12.0;
  const totalPayable = Math.round(principal * (1 + interestRate / 100));
  const cleanPurpose = purpose.trim() || "Personal / Working Capital";

  await prisma.loan.create({
    data: {
      userId: session.user.id,
      amount: principal,
      totalPayable,
      termMonths,
      interestRate,
      purpose: cleanPurpose,
      status: "PENDING",
    },
  });

  // Alert admin via email (wrapped in try/catch so email issues never fail the loan request)
  try {
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || "$";
    await notifyAdminLoanApplication({
      userName: user.name || "Vault Member",
      accountNo: user.accountNo,
      amountFormatted: `${currency}${(principal / 100).toFixed(2)}`,
      termMonths,
      purpose: cleanPurpose,
    });
  } catch (mailErr) {
    console.error("Failed to send admin loan alert email:", mailErr);
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { success: "Loan application submitted for compliance review!" };
}


export async function repayLoan(loanId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };
  const userId = session.user.id;

  try {
    return await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({ where: { id: loanId } });
      if (!loan || loan.userId !== userId || loan.status !== "APPROVED") {
        throw new Error("Active approved loan not found.");
      }

      const balance = await getUserBalance(userId);
      if (balance < loan.totalPayable) {
        throw new Error("Insufficient balance to settle this loan.");
      }

      // Debit the user's ledger (receiverId null = returned to system treasury)
      await tx.transaction.create({
        data: {
          senderId: userId,
          receiverId: null,
          amount: loan.totalPayable,
          description: `Loan Settlement (${loan.termMonths}m Facility)`,
        },
      });

      await tx.loan.update({
        where: { id: loanId },
        data: { status: "PAID" },
      });

      return { success: "Loan facility repaid in full!" };
    });
  } catch (err: any) {
    return { error: err.message || "Failed to repay loan." };
  } finally {
    revalidatePath("/dashboard");
    revalidatePath("/admin");
  }
}

export async function submitKycDocument(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  const idType = (formData.get("idType") as string)?.trim();
  const idNumber = (formData.get("idNumber") as string)?.trim();
  const file = formData.get("idFile") as File | null;

  if (!idType || !idNumber) {
    return { error: "Please select an ID type and enter your ID number." };
  }

  if (!file || file.size === 0) {
    return { error: "Please attach a clear image or scan of your ID document." };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "File size exceeds 5MB limit." };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return { error: "Only JPG, PNG, WebP, or PDF documents are accepted." };
  }

  try {
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "application/pdf": "pdf",
    };
    const fileExt = extMap[file.type] || "bin";
    const filePath = `${session.user.id}/${Date.now()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("kyc-documents")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return { error: `Upload failed: ${uploadError.message}` };
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("kyc-documents")
      .getPublicUrl(filePath);

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        idType,
        idNumber,
        idDocumentUrl: publicUrlData.publicUrl,
        kycStatus: "PENDING",
      },
      select: { name: true, accountNo: true },
    });
    try {
      await notifyAdminKycUpload({
        userName: updatedUser.name || "Vault Member",
        accountNo: updatedUser.accountNo,
        idType,
        idNumber,
      });
    } catch (mailErr) {
      console.error("Failed to send admin KYC alert email:", mailErr);
    }

    revalidatePath("/dashboard");
    revalidatePath("/admin");
    return { success: "ID document uploaded! Status is now Pending Compliance Review." };
  } catch (err: any) {
    return { error: err.message || "Failed to submit identity document." };
  }
}

