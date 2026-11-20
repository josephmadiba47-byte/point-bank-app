import { renderEmailLayout } from "./layout";

export function welcomeAccountTemplate({
  vaultName,
  userName,
  accountNo,
  email,
  password,
  accountTier,
  loginUrl,
  createdByAdmin = false,
}: {
  vaultName: string;
  userName: string;
  accountNo: number | string;
  email: string;
  password: string;
  accountTier: string;
  loginUrl: string;
  createdByAdmin?: boolean;
}) {
  return renderEmailLayout({
    vaultName,
    title: `Welcome to ${vaultName}`,
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:20px;color:#0f172a;">Welcome to ${vaultName}, ${userName}!</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">
        ${
          createdByAdmin
            ? `An administrator has provisioned your <strong>${accountTier}</strong> vault account. Below are your official login credentials to access your ledger.`
            : `Thank you for opening a <strong>${accountTier}</strong> vault account with us. Your account is now active and ready for secure transfers.`
        }
      </p>

      <!-- Official Credentials Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:16px;margin:20px 0;">
        <tr>
          <td style="padding:6px 0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">
            <strong>Login Account Number</strong>
          </td>
          <td align="right" style="padding:6px 0;font-family:monospace;font-size:18px;font-weight:900;color:#4f46e5;">
            ${accountNo}
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
            <strong>Registered Email</strong>
          </td>
          <td align="right" style="padding:6px 0;border-top:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#0f172a;">
            ${email}
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
            <strong>Account Password</strong>
          </td>
          <td align="right" style="padding:6px 0;border-top:1px solid #e2e8f0;font-family:monospace;font-size:13px;font-weight:700;color:#0f172a;">
            ${password}
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
            <strong>Account Tier</strong>
          </td>
          <td align="right" style="padding:6px 0;border-top:1px solid #e2e8f0;font-size:12px;font-weight:700;color:#047857;">
            ${accountTier}
          </td>
        </tr>
      </table>

      <div style="margin:24px 0;text-align:center;">
        <a href="${loginUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:13px 28px;border-radius:10px;">
          Sign In to Your Vault →
        </a>
      </div>

      <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">
        <strong>Security Tip:</strong> Please keep your Account Number safe—you will need it every time you sign in. ${
          createdByAdmin
            ? "We recommend updating your password inside your Account Profile tab after your first login."
            : "For your protection, consider deleting this email once you have saved your credentials."
        }
      </p>
    `,
  });
}
