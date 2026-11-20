export function renderEmailLayout({
  vaultName,
  title,
  bodyHtml,
}: {
  vaultName: string;
  title: string;
  bodyHtml: string;
}) {
  const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL;

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
              <!-- Header with Company Logo -->
              <tr>
                <td style="background:#0f172a;padding:24px 28px;text-align:left;">
                  ${
                    logoUrl
                      ? `<img src="${logoUrl}" alt="${vaultName}" height="32" style="display:inline-block;vertical-align:middle;margin-right:10px;border-radius:6px;" />`
                      : `<span style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;background:#4f46e5;color:#ffffff;font-weight:900;border-radius:8px;margin-right:10px;vertical-align:middle;">${vaultName.charAt(0).toUpperCase()}</span>`
                  }
                  <span style="color:#ffffff;font-size:16px;font-weight:700;vertical-align:middle;letter-spacing:-0.3px;">
                    ${vaultName}
                  </span>
                </td>
              </tr>

              <!-- Body Content -->
              <tr>
                <td style="padding:28px;">
                  ${bodyHtml}
                </td>
              </tr>

              <!-- Security Footer -->
              <tr>
                <td style="background:#f8fafc;padding:18px 28px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;line-height:1.5;">
                  This is an automated security notification from <strong>${vaultName}</strong>. Never share your 2FA codes or password reset links with anyone, including vault staff.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}
