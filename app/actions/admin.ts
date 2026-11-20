"use server";

import { auth } from "@/auth";
import { getUserBalance } from "@/lib/ledger";
import {  notifyUserLoanDecision, notifyUserKycDecision, sendAdminCustomMail, sendWireAuthCodeToUser, sendWelcomeEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { formatCurrency, validatePasswordStrength } from "@/lib/utils";
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
    const accountTier = (formData.get("accountTier") as string) || "STANDARD";

    if (!name || !email || !password) {
      return { error: "Name, email, and password are required." };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "An account with this email already exists." };

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.isValid) {
        return { error: passwordCheck.message };
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const createdUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        accountTier,
        passText: password,
      },
    });
    try {
      await sendWelcomeEmail(email.toLowerCase(), {
        userName: name,
        accountNo: createdUser.accountNo,
        password,
        accountTier,
        createdByAdmin: true,
      });
    } catch (mailErr) {
      console.error("Failed to send admin-created welcome email:", mailErr);
    }

    revalidatePath("/admin");
    return { success: `Account #${createdUser.accountNo} created for ${name} (${accountTier} Tier) and welcome email sent.` };
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

// Updated adminReviewLoan:
export async function adminReviewLoan(loanId: string, decision: "APPROVED" | "REJECTED") {
  try {
    await verifyAdmin();

    const updatedLoan = await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        include: { user: { select: { name: true, email: true } } },
      });

      if (!loan || loan.status !== "PENDING") {
        throw new Error("Loan application is no longer pending.");
      }

      await tx.loan.update({
        where: { id: loanId },
        data: { status: decision },
      });

      if (decision === "APPROVED") {
        await tx.transaction.create({
          data: {
            receiverId: loan.userId,
            amount: loan.amount,
            description: `Loan Disbursement (${loan.termMonths}m @ ${loan.interestRate}%)`,
          },
        });
      }

      return loan;
    });

    // Email the user outside the DB transaction
    if (updatedLoan.user.email) {
      try {
        const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || "$";
        await notifyUserLoanDecision(updatedLoan.user.email, {
          userName: updatedLoan.user.name || "Vault Member",
          decision,
          amountFormatted: `${currency}${(updatedLoan.amount / 100).toFixed(2)}`,
          termMonths: updatedLoan.termMonths,
        });
      } catch (mailErr) {
        console.error("Failed to email user loan decision:", mailErr);
      }
    }

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { success: `Loan application ${decision.toLowerCase()}.` };
  } catch (err: any) {
    return { error: err.message || "Failed to process loan review." };
  }
}

// Updated adminReviewKyc:
export async function adminReviewKyc(targetUserId: string, decision: "VERIFIED" | "REJECTED") {
  try {
    await verifyAdmin();

    const targetUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { kycStatus: decision },
      select: { email: true, name: true },
    });

    if (targetUser.email) {
      try {
        await notifyUserKycDecision(
          targetUser.email,
          targetUser.name || "Vault Member",
          decision
        );
      } catch (mailErr) {
        console.error("Failed to email user KYC decision:", mailErr);
      }
    }

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { success: `User KYC status updated to ${decision}.` };
  } catch (err: any) {
    return { error: err.message || "Failed to update KYC status." };
  }
}


export async function adminUpdateSettings(formData: FormData) {
  try {
    await verifyAdmin();

    const vaultName = (formData.get("vaultName") as string)?.trim() || "PointVault";
    const supportEmail = (formData.get("supportEmail") as string)?.trim() || "";
    const supportPhone = (formData.get("supportPhone") as string)?.trim() || "";
    const officeAddress = (formData.get("officeAddress") as string)?.trim() || "";
    const operatingHours = (formData.get("operatingHours") as string)?.trim() || "";
    const noticeBanner = (formData.get("noticeBanner") as string)?.trim() || null;

    await prisma.systemSettings.upsert({
      where: { id: "global" },
      update: {
        vaultName,
        supportEmail,
        supportPhone,
        officeAddress,
        operatingHours,
        noticeBanner,
      },
      create: {
        id: "global",
        vaultName,
        supportEmail,
        supportPhone,
        officeAddress,
        operatingHours,
        noticeBanner,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { success: "Global vault settings and contact details saved." };
  } catch (err: any) {
    return { error: err.message || "Failed to save system settings." };
  }
}

export async function adminAssignOfficer(
  targetUserId: string,
  officerName: string,
  officerEmail: string
) {
  try {
    await verifyAdmin();

    const cleanName = officerName.trim() || null;
    const cleanEmail = officerEmail.trim() || null;

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        accountOfficerName: cleanName,
        accountOfficerEmail: cleanEmail,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return {
      success: cleanName
        ? `Assigned ${cleanName} as Account Officer.`
        : "Account Officer assignment cleared.",
    };
  } catch (err: any) {
    return { error: err.message || "Failed to assign Account Officer." };
  }
}

export async function adminUpdateAccountTier(targetUserId: string, newTier: string) {
  try {
    await verifyAdmin();

    const allowedTiers = ["STANDARD", "SILVER", "GOLD", "PLATINUM"];
    if (!allowedTiers.includes(newTier)) {
      return { error: "Invalid account tier selected." };
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { accountTier: newTier },
    });

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { success: `Account tier updated to ${newTier}.` };
  } catch (err: any) {
    return { error: err.message || "Failed to update account tier." };
  }
}

export async function adminDebitCredits(userId: string, amountStr: string, memo: string) {
  try {
    await verifyAdmin();

    const amount = Math.round(parseFloat(amountStr) * 100);
    if (isNaN(amount) || amount <= 0) {
      return { error: "Enter a valid debit amount greater than zero." };
    }

    const currentBalance = await getUserBalance(userId);
    if (currentBalance < amount) {
      return { error: `Cannot deduct ${formatCurrency(amount / 100, currency)} — user only has ${formatCurrency(currentBalance / 100, currency)}.` };
    }

    await prisma.transaction.create({
      data: {
        senderId: userId,
        receiverId: null, // Returned to system treasury
        amount,
        description: memo.trim() || "Treasury Credit Adjustment (Reversal)",
      },
    });

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { success: `Deducted ${formatCurrency(amount / 100, currency)} successfully.` };
  } catch (err: any) {
    return { error: err.message || "Failed to deduct credits." };
  }
}

export async function adminDeleteUser(targetUserId: string) {
  try {
    await verifyAdmin();

    const session = await auth();
    if (session?.user?.id === targetUserId) {
      return { error: "You cannot delete your own active admin account." };
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true, name: true, email: true, accountNo: true },
    });

    if (!target) {
      return { error: "User account not found." };
    }

    if (target.role === "ADMIN") {
      return { error: "Administrator accounts cannot be deleted." };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Detach historical transactions so ledger audit records remain intact
      await tx.transaction.updateMany({
        where: { senderId: targetUserId },
        data: { senderId: null },
      });

      await tx.transaction.updateMany({
        where: { receiverId: targetUserId },
        data: { receiverId: null },
      });

      // 2. Delete the user (cascades automatically to Beneficiaries, Loans, and Accounts)
      await tx.user.delete({
        where: { id: targetUserId },
      });
    });

    revalidatePath("/admin");
    return {
      success: `Account #${target.accountNo} (${target.name || target.email}) has been permanently deleted.`,
    };
  } catch (err: any) {
    return { error: err.message || "Failed to delete user account." };
  }
}

export async function adminSendAuthCodeEmail(txId: string) {
  try {
    await verifyAdmin();

    const tx = await prisma.transaction.findUnique({
      where: { id: txId },
      include: { sender: { select: { name: true, email: true } } },
    });

    if (!tx || !tx.authCode || !tx.sender?.email) {
      return { error: "Pending transaction or sender email not found." };
    }

    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || "$";
    await sendWireAuthCodeToUser(tx.sender.email, {
      userName: tx.sender.name || "Vault Member",
      authCode: tx.authCode,
      amountFormatted: `${currency}${(tx.amount / 100).toFixed(2)}`,
      recipientName: tx.recipientName || "External Recipient",
      recipientAccountNo: tx.recipientAccountNo || "N/A",
    });

    return { success: `Authorization code (${tx.authCode}) emailed to ${tx.sender.email}.` };
  } catch (err: any) {
    return { error: err.message || "Failed to send authorization code email." };
  }
}

export async function adminDispatchCustomEmail(formData: FormData) {
  try {
    await verifyAdmin();

    const targetMode = (formData.get("targetMode") as "SINGLE" | "ALL") || "SINGLE";
    const singleUserId = (formData.get("singleUserId") as string) || "";
    const subject = (formData.get("subject") as string)?.trim() || "";
    const messageBody = (formData.get("messageBody") as string)?.trim() || "";

    if (!subject || !messageBody) {
      return { error: "Email subject and message body are required." };
    }

    // Extract optional file attachments
    const rawFiles = formData.getAll("attachments") as File[];
    const validFiles = rawFiles.filter((f) => f && f.size > 0);

    const totalBytes = validFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > 4 * 1024 * 1024) {
      return { error: "Total attachment size cannot exceed 4MB." };
    }

    const attachments = await Promise.all(
      validFiles.map(async (file) => ({
        filename: file.name,
        content: Buffer.from(await file.arrayBuffer()),
      }))
    );

    let recipients: { email: string; name: string }[] = [];

    if (targetMode === "ALL") {
      const users = await prisma.user.findMany({
        where: { role: "USER", email: { not: null } },
        select: { email: true, name: true },
      });
      recipients = users
        .filter((u): u is { email: string; name: string | null } => Boolean(u.email))
        .map((u) => ({ email: u.email, name: u.name || "Vault Member" }));
    } else {
      const user = await prisma.user.findUnique({
        where: { id: singleUserId },
        select: { email: true, name: true },
      });
      if (!user?.email) return { error: "Selected user does not have a valid email." };
      recipients = [{ email: user.email, name: user.name || "Vault Member" }];
    }

    if (recipients.length === 0) {
      return { error: "No valid recipient email addresses found." };
    }

    await sendAdminCustomMail(
      recipients,
      subject,
      messageBody,
      attachments.length > 0 ? attachments : undefined
    );

    const attachNote =
      attachments.length > 0 ? ` with ${attachments.length} attachment(s)` : "";

    return {
      success:
        targetMode === "ALL"
          ? `Broadcast sent${attachNote} to ${recipients.length} user(s).`
          : `Email sent${attachNote} to ${recipients[0].name} (${recipients[0].email}).`,
    };
  } catch (err: any) {
    return { error: err.message || "Failed to dispatch email." };
  }
}
