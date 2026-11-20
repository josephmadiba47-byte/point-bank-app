import { renderEmailLayout } from "./layout";

export function forgotPasswordTemplate({
  vaultName,
  userName,
  resetUrl,
}: {
  vaultName: string;
  userName: string;
  resetUrl: string;
}) {
  return renderEmailLayout({
    vaultName,
    title: "Reset Your Vault Password",
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Password Reset Request</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">
        Hello <strong>${userName || "Vault Member"}</strong>, we received a request to reset your ${vaultName} password. Click the button below to choose a new password. This link expires in <strong>30 minutes</strong>.
      </p>
      <div style="margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 24px;border-radius:10px;">
          Reset Password
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#64748b;">
        If you did not request a password reset, you can safely ignore this email.
      </p>
    `,
  });
}
