import { renderEmailLayout } from "./layout";

export function kycUploadAdminTemplate({
  vaultName,
  userName,
  accountNo,
  idType,
  idNumber,
}: {
  vaultName: string;
  userName: string;
  accountNo: number | string;
  idType: string;
  idNumber: string;
}) {
  return renderEmailLayout({
    vaultName,
    title: "New KYC Document Uploaded",
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">New Identity Verification Submission</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">
        <strong>${userName}</strong> (#${accountNo}) uploaded an identity document for KYC compliance review.
      </p>
      <table width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;font-size:13px;color:#0f172a;margin:16px 0;">
        <tr><td style="padding:4px 0;"><strong>ID Type:</strong> ${idType}</td></tr>
        <tr><td style="padding:4px 0;"><strong>Document Number:</strong> ${idNumber}</td></tr>
      </table>
      <p style="margin:0;font-size:12px;color:#64748b;">
        Open the KYC Reviews tab in your Admin Console to inspect the document and update verification status.
      </p>
    `,
  });
}

export function kycDecisionUserTemplate({
  vaultName,
  userName,
  decision,
}: {
  vaultName: string;
  userName: string;
  decision: "VERIFIED" | "REJECTED";
}) {
  const isVerified = decision === "VERIFIED";
  return renderEmailLayout({
    vaultName,
    title: `Identity Verification ${decision}`,
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:18px;color:${isVerified ? "#047857" : "#b91c1c"};">
        KYC Status: ${isVerified ? "Verified" : "Action Required"}
      </h2>
      <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">
        Hello <strong>${userName}</strong>, your identity verification submission has been reviewed and marked as <strong>${decision}</strong>.
      </p>
      <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
        ${
          isVerified
            ? "Your vault profile now displays a Verified KYC badge."
            : "Please log in to your Account Profile tab and upload a clearer copy of your government-issued ID."
        }
      </p>
    `,
  });
}
