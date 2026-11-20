import { renderEmailLayout } from "./layout";

export function loanApplicationAdminTemplate({
  vaultName,
  userName,
  accountNo,
  amountFormatted,
  termMonths,
  purpose,
}: {
  vaultName: string;
  userName: string;
  accountNo: number | string;
  amountFormatted: string;
  termMonths: number;
  purpose: string;
}) {
  return renderEmailLayout({
    vaultName,
    title: "New Loan Application Submitted",
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">New Credit Facility Request</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">
        <strong>${userName}</strong> (#${accountNo}) has submitted a loan application requiring compliance review.
      </p>
      <table width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;font-size:13px;color:#0f172a;margin:16px 0;">
        <tr><td style="padding:4px 0;"><strong>Principal Requested:</strong> ${amountFormatted}</td></tr>
        <tr><td style="padding:4px 0;"><strong>Repayment Tenure:</strong> ${termMonths} Months</td></tr>
        <tr><td style="padding:4px 0;"><strong>Purpose:</strong> ${purpose}</td></tr>
      </table>
      <p style="margin:0;font-size:12px;color:#64748b;">
        Log in to your Admin Console to approve and disburse or decline this application.
      </p>
    `,
  });
}

export function loanDecisionUserTemplate({
  vaultName,
  userName,
  decision,
  amountFormatted,
  termMonths,
}: {
  vaultName: string;
  userName: string;
  decision: "APPROVED" | "REJECTED";
  amountFormatted: string;
  termMonths: number;
}) {
  const isApproved = decision === "APPROVED";
  return renderEmailLayout({
    vaultName,
    title: `Loan Application ${decision}`,
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:18px;color:${isApproved ? "#047857" : "#b91c1c"};">
        Loan Application ${isApproved ? "Approved & Disbursed" : "Declined"}
      </h2>
      <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">
        Hello <strong>${userName}</strong>, your loan request for <strong>${amountFormatted}</strong> (${termMonths} months) has been <strong>${decision.toLowerCase()}</strong>.
      </p>
      <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
        ${
          isApproved
            ? "The approved principal has been credited directly to your vault ledger balance."
            : "Please contact your dedicated Account Officer or the compliance desk if you have questions regarding this decision."
        }
      </p>
    `,
  });
}
