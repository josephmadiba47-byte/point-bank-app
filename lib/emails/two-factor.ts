import { renderEmailLayout } from "./layout";

export function twoFactorTemplate({
  vaultName,
  userName,
  code,
}: {
  vaultName: string;
  userName: string;
  code: string;
}) {
  return renderEmailLayout({
    vaultName,
    title: "Your 2FA Verification Code",
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Two-Factor Authentication</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">
        Hello <strong>${userName || "Vault Member"}</strong>, use the 6-digit security code below to complete your sign-in. This code expires in <strong>10 minutes</strong>.
      </p>
      <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:12px;padding:16px;text-align:center;margin:20px 0;">
        <span style="font-family:monospace;font-size:28px;font-weight:900;letter-spacing:8px;color:#0f172a;">
          ${code}
        </span>
      </div>
      <p style="margin:0;font-size:12px;color:#64748b;">
        If you did not attempt to sign in, change your password immediately.
      </p>
    `,
  });
}
