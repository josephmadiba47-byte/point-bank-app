import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { forgotPasswordTemplate } from "./emails/forgot-password";
import { twoFactorTemplate } from "./emails/two-factor";
import { foreignDeviceTemplate } from "./emails/foreign-device";
import { loanApplicationAdminTemplate, loanDecisionUserTemplate, } from "./emails/loan-notifications";
import {  kycUploadAdminTemplate,  kycDecisionUserTemplate, } from "./emails/kyc-notifications";
import {  wireAuthCodeTemplate,  adminCustomMessageTemplate, } from "./emails/admin-dispatch";
import { welcomeAccountTemplate } from "./emails/welcome";

const resendKey = process.env.RESEND_API_KEY;
const resend = new Resend(resendKey);

const SENDER_EMAIL = process.env.EMAIL_FROM || "onboarding@resend.dev";
const SANDBOX_FALLBACK_RECIPIENT = process.env.RESEND_SANDBOX_EMAIL || "email@gmail.com";

const getSafeRecipientsList = (requestedTargetArray: string | string[]): string[] => {
  // If running on Resend's unverified demo sender, force all mail into your primary testing sandbox inbox
  if (SENDER_EMAIL.includes("onboarding@resend.dev")) {
    return [SANDBOX_FALLBACK_RECIPIENT];
  }
  return Array.isArray(requestedTargetArray)
    ? requestedTargetArray
    : [requestedTargetArray];
};

async function getVaultName() {
  const settings = await prisma.systemSettings.findUnique({ where: { id: "global" } });
  return settings?.vaultName || process.env.NEXT_PUBLIC_SITE_NAME || "PointVault";
}

async function getAdminAlertEmails(): Promise<string[]> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: "global" } });
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true },
  });
  const emails = [
    ...(settings?.supportEmail ? [settings.supportEmail] : []),
    ...admins.map((a) => a.email).filter((e): e is string => Boolean(e)),
  ];
  return Array.from(new Set(emails));
}

export async function sendPasswordResetEmail(email: string, userName: string, token: string) {
  const vaultName = await getVaultName();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  await resend.emails.send({
    from: `${vaultName} Security <${SENDER_EMAIL}>`,
    to: getSafeRecipientsList(email),
    subject: `${vaultName} — Reset Your Password`,
    html: forgotPasswordTemplate({ vaultName, userName, resetUrl }),
  });
}

export async function sendTwoFactorEmail(email: string, userName: string, code: string) {
  const vaultName = await getVaultName();

  await resend.emails.send({
    from: `${vaultName} Security <${SENDER_EMAIL}>`,
    to: getSafeRecipientsList(email),
    subject: `${code} is your ${vaultName} verification code`,
    html: twoFactorTemplate({ vaultName, userName, code }),
  });
}

export async function sendForeignDeviceAlert(
  email: string,
  userName: string,
  deviceLabel: string,
  ipAddress: string
) {
  const vaultName = await getVaultName();
  const loginTime = new Date().toUTCString();

  await resend.emails.send({
    from: `${vaultName} Security <${SENDER_EMAIL}>`,
    to: getSafeRecipientsList(email),
    subject: `Security Alert: New Device Sign-In to ${vaultName}`,
    html: foreignDeviceTemplate({ vaultName, userName, deviceLabel, ipAddress, loginTime }),
  });
}

export async function notifyAdminLoanApplication(data: {
  userName: string;
  accountNo: number | string;
  amountFormatted: string;
  termMonths: number;
  purpose: string;
}) {
  const vaultName = await getVaultName();
  const adminEmails = await getAdminAlertEmails();
  if (adminEmails.length === 0) return;

  await resend.emails.send({
    from: `${vaultName} Alerts <${SENDER_EMAIL}>`,
    to: getSafeRecipientsList(adminEmails),
    subject: `[Admin Alert] New Loan Application — ${data.userName} (#${data.accountNo})`,
    html: loanApplicationAdminTemplate({ vaultName, ...data }),
  });
}

export async function notifyUserLoanDecision(
  email: string,
  data: {
    userName: string;
    decision: "APPROVED" | "REJECTED";
    amountFormatted: string;
    termMonths: number;
  }
) {
  const vaultName = await getVaultName();
  await resend.emails.send({
    from: `${vaultName} Credit Desk <${SENDER_EMAIL}>`,
    to: getSafeRecipientsList(email),
    subject: `${vaultName} — Your Loan Application Was ${data.decision}`,
    html: loanDecisionUserTemplate({ vaultName, ...data }),
  });
}

export async function notifyAdminKycUpload(data: {
  userName: string;
  accountNo: number | string;
  idType: string;
  idNumber: string;
}) {
  const vaultName = await getVaultName();
  const adminEmails = await getAdminAlertEmails();
  if (adminEmails.length === 0) return;

  await resend.emails.send({
    from: `${vaultName} Compliance <${SENDER_EMAIL}>`,
    to: getSafeRecipientsList(adminEmails),
    subject: `[Admin Alert] New KYC Document — ${data.userName} (#${data.accountNo})`,
    html: kycUploadAdminTemplate({ vaultName, ...data }),
  });
}

export async function notifyUserKycDecision(
  email: string,
  userName: string,
  decision: "VERIFIED" | "REJECTED"
) {
  const vaultName = await getVaultName();
  await resend.emails.send({
    from: `${vaultName} Compliance <${SENDER_EMAIL}>`,
    to: getSafeRecipientsList(email),
    subject: `${vaultName} — Identity Verification ${decision}`,
    html: kycDecisionUserTemplate({ vaultName, userName, decision }),
  });
}

export async function sendWireAuthCodeToUser(
  email: string,
  data: {
    userName: string;
    authCode: string;
    amountFormatted: string;
    recipientName: string;
    recipientAccountNo: string;
  }
) {
  const vaultName = await getVaultName();
  await resend.emails.send({
    from: `${vaultName} Wire Desk <${SENDER_EMAIL}>`,
    to: getSafeRecipientsList(email),
    subject: `${vaultName} — Wire Authorization Code (${data.authCode})`,
    html: wireAuthCodeTemplate({ vaultName, ...data }),
  });
}

export async function sendAdminCustomMail(
  recipients: { email: string; name: string }[],
  subject: string,
  messageBody: string,
  attachments?: { filename: string; content: Buffer }[]
) {
  const vaultName = await getVaultName();

  // If sandbox mode is active, send a single representative email to avoid rate limits
  if (SENDER_EMAIL.includes("onboarding@resend.dev")) {
    const first = recipients[0];
    await resend.emails.send({
      from: `${vaultName} Desk <${SENDER_EMAIL}>`,
      to: getSafeRecipientsList(first.email),
      subject: `${vaultName} — ${subject}`,
      html: adminCustomMessageTemplate({
        vaultName,
        userName: recipients.length > 1 ? `Vault Members (${recipients.length})` : first.name,
        subject,
        messageBody,
      }),
      attachments,
    });
    return;
  }

  await Promise.all(
    recipients.map((r) =>
      resend.emails.send({
        from: `${vaultName} Desk <${SENDER_EMAIL}>`,
        to: r.email,
        subject: `${vaultName} — ${subject}`,
        html: adminCustomMessageTemplate({
          vaultName,
          userName: r.name,
          subject,
          messageBody,
        }),
        attachments,
      })
    )
  );
}


export async function sendWelcomeEmail(
  email: string,
  data: {
    userName: string;
    accountNo: number | string;
    password: string;
    accountTier: string;
    createdByAdmin?: boolean;
  }
) {
  const vaultName = await getVaultName();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const loginUrl = `${baseUrl}/login`;

  await resend.emails.send({
    from: `${vaultName} Onboarding <${SENDER_EMAIL}>`,
    to: getSafeRecipientsList(email),
    subject: `Welcome to ${vaultName} — Your Account Number (#${data.accountNo})`,
    html: welcomeAccountTemplate({
      vaultName,
      email,
      loginUrl,
      ...data,
    }),
  });
}
