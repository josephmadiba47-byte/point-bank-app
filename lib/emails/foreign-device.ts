import { renderEmailLayout } from "./layout";

export function foreignDeviceTemplate({
  vaultName,
  userName,
  deviceLabel,
  ipAddress,
  loginTime,
}: {
  vaultName: string;
  userName: string;
  deviceLabel: string;
  ipAddress: string;
  loginTime: string;
}) {
  return renderEmailLayout({
    vaultName,
    title: "New Device Sign-In Alert",
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:18px;color:#b91c1c;">⚠️ New Device Sign-In Detected</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">
        Hello <strong>${userName || "Vault Member"}</strong>, your ${vaultName} account was just accessed from a device or location we haven't seen before.
      </p>
      <table width="100%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px;font-size:13px;color:#7f1d1d;margin:16px 0;">
        <tr><td style="padding:4px 0;"><strong>Device / Browser:</strong> ${deviceLabel}</td></tr>
        <tr><td style="padding:4px 0;"><strong>IP Address:</strong> ${ipAddress}</td></tr>
        <tr><td style="padding:4px 0;"><strong>Time:</strong> ${loginTime}</td></tr>
      </table>
      <p style="margin:0;font-size:12px;color:#64748b;">
        If this was you, no action is needed. If you do not recognize this activity, reset your password immediately or contact your Account Officer.
      </p>
    `,
  });
}
