import { renderEmailLayout } from "./layout";

export function wireAuthCodeTemplate({
  vaultName,
  userName,
  authCode,
  amountFormatted,
  recipientName,
  recipientAccountNo,
}: {
  vaultName: string;
  userName: string;
  authCode: string;
  amountFormatted: string;
  recipientName: string;
  recipientAccountNo: string;
}) {
  return renderEmailLayout({
    vaultName,
    title: "Your Wire Authorization PIN",
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Wire Release Authorization Code</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">
        Hello <strong>${userName}</strong>, compliance has issued your 6-digit release PIN for your pending transfer of <strong>${amountFormatted}</strong> to <strong>${recipientName}</strong> (#${recipientAccountNo}).
      </p>
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px;text-align:center;margin:20px 0;">
        <span style="font-family:monospace;font-size:28px;font-weight:900;letter-spacing:8px;color:#0f172a;">
          ${authCode}
        </span>
      </div>
      <p style="margin:0;font-size:12px;color:#64748b;">
        Click your pending transfer on the dashboard and enter this PIN to settle the wire immediately.
      </p>
    `,
  });
}

export function adminCustomMessageTemplate({
  vaultName,
  userName,
  subject,
  messageBody,
}: {
  vaultName: string;
  userName: string;
  subject: string;
  messageBody: string;
}) {
  const safeHtmlBody = messageBody
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");

  return renderEmailLayout({
    vaultName,
    title: subject,
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">${subject}</h2>
      <p style="margin:0 0 14px;font-size:14px;color:#334155;">
        Dear <strong>${userName}</strong>,
      </p>
      <div style="font-size:14px;color:#334155;line-height:1.65;margin-bottom:16px;">
        ${safeHtmlBody}
      </div>
    `,
  });
}
