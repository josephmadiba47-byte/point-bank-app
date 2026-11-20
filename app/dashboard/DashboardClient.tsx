"use client";

import { useState, useRef, useEffect } from "react";
import { requestTransfer, confirmTransfer, cancelTransfer } from "@/app/actions/transfer";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { saveBeneficiary, deleteBeneficiary } from "../actions/beneficiary";
import { updateProfile, applyForLoan, repayLoan, submitKycDocument } from "@/app/actions/profile-loan";
import { useRouter } from "next/navigation";
import { toggleTwoFactor } from "../actions/security";



interface TransactionItem {
  id: string;
  amount: number;
  description: string;
  createdAt: Date;
  authCode: string | null;
  senderId: string | null;
  recipientName: string | null;
  recipientAccountNo: string | null;
  recipientSystemName: string | null;
  routingNumber: string | null;
  sender: { accountNo: number } | null;
  receiver: { accountNo: number } | null;
}

interface BeneficiaryItem {
  id: string;
  accountName: string;
  accountNo: string;
  systemName: string;
  routingNo: string;
}

interface LoanItem {
  id: string;
  amount: number;
  totalPayable: number;
  termMonths: number;
  interestRate: number;
  purpose: string;
  status: string;
  createdAt: Date;
}

interface SystemSettingsItem {
  id: string;
  vaultName: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  officeAddress: string | null;
  operatingHours: string | null;
  noticeBanner: string | null;
}

interface Props {
  userId: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  userAddress?: string;
  idType?: string | null;
  idNumber?: string | null;
  idDocumentUrl?: string | null;
  kycStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  currentBalance: number;
  currentAccountNo: number | string;
  transactions: TransactionItem[];
  beneficiaries: BeneficiaryItem[];
  loans: LoanItem[];
  settings: SystemSettingsItem;
  hasPending: boolean;
  accountOfficerName?: string | null;
  accountOfficerEmail?: string | null;
  accountTier?: string | null;
  twoFactorEnabled: boolean;
}

export default function DashboardClient({
  userId,
  userName,
  userEmail,
  userPhone,
  userAddress,
  idType,
  idNumber,
  idDocumentUrl,
  kycStatus,
  currentBalance,
  currentAccountNo,
  transactions,
  beneficiaries,
  loans,
  settings,
  hasPending,
  accountOfficerName,
  accountOfficerEmail,
  accountTier,
  twoFactorEnabled
}: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});

  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [verificationPin, setVerificationPin] = useState("");
  const [modalFeedback, setModalFeedback] = useState("");
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$';
  const vaultName = settings.vaultName || process.env.NEXT_PUBLIC_SITE_NAME || "PointVault";
  const [selectedReceipt, setSelectedReceipt] = useState<TransactionItem | null>(null);

  const [recipientName, setRecipientName] = useState("");
  const [recipientAccountNo, setRecipientAccountNo] = useState("");
  const [recipientSystemName, setRecipientSystemName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [saveAsBeneficiary, setSaveAsBeneficiary] = useState(false);

  const [is2FAEnabled, setIs2FAEnabled] = useState(twoFactorEnabled);
  const [toggling2FA, setToggling2FA] = useState(false);


  const [dashTab, setDashTab] = useState<"overview" | "loans" | "profile" | "contact">("overview");
  const [dashMenuOpen, setDashMenuOpen] = useState(false);
  const dashMenuRef = useRef<HTMLDivElement>(null); 
  const [loanAmount, setLoanAmount] = useState("");
  const [loanTerm, setLoanTerm] = useState(3);
  const [loanPurpose, setLoanPurpose] = useState("");
  const [loanLoading, setLoanLoading] = useState(false);
  const [loanFeedback, setLoanFeedback] = useState<{ error?: string; success?: string }>({});
  const [profileFeedback, setProfileFeedback] = useState<{ error?: string; success?: string }>({});
  const [profileLoading, setProfileLoading] = useState(false);

  const [kycLoading, setKycLoading] = useState(false);
  const [kycFeedback, setKycFeedback] = useState<{ error?: string; success?: string }>({});

  const [showPassword, setShowPassword] = useState(false);
  const ratePreview = loanTerm === 3 ? 5.0 : loanTerm === 6 ? 8.5 : 12.0;
  const numericLoan = parseFloat(loanAmount) || 0;
  const estimatedRepayment = numericLoan * (1 + ratePreview / 100);


  const [historySearch, setHistorySearch] = useState("");
const [historyPage, setHistoryPage] = useState(1);
const HISTORY_PAGE_SIZE = 5;

const filteredTransactions = transactions.filter((tx) => {
  const q = historySearch.toLowerCase().trim();
  if (!q) return true;
  return (
    tx.description.toLowerCase().includes(q) ||
    tx.recipientName?.toLowerCase().includes(q) ||
    tx.recipientAccountNo?.toLowerCase().includes(q) ||
    tx.recipientSystemName?.toLowerCase().includes(q) ||
    tx.routingNumber?.toLowerCase().includes(q) ||
    String(tx.sender?.accountNo || "").includes(q) ||
    String(tx.receiver?.accountNo || "").includes(q)
  );
});

const totalHistoryPages = Math.max(1, Math.ceil(filteredTransactions.length / HISTORY_PAGE_SIZE));
const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
const paginatedTransactions = filteredTransactions.slice(
  (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
  safeHistoryPage * HISTORY_PAGE_SIZE
);

  const formRef = useRef<HTMLFormElement>(null);

  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  
  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  }

  useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (dashMenuRef.current && !dashMenuRef.current.contains(event.target as Node)) {
      setDashMenuOpen(false);
    }
  }
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);

const [beneficiarySearch, setBeneficiarySearch] = useState("");
const [beneficiaryMenuOpen, setBeneficiaryMenuOpen] = useState(false);
const beneficiaryMenuRef = useRef<HTMLDivElement>(null);
const [deletingBeneficiaryId, setDeletingBeneficiaryId] = useState<string | null>(null);


useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (beneficiaryMenuRef.current && !beneficiaryMenuRef.current.contains(event.target as Node)) {
      setBeneficiaryMenuOpen(false);
    }
  }
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);

const [loanSearch, setLoanSearch] = useState("");
const [loanPage, setLoanPage] = useState(1);
const LOAN_PAGE_SIZE = 5;

const filteredLoans = loans.filter((loan) => {
  const q = loanSearch.toLowerCase().trim();
  if (!q) return true;
  return (
    loan.purpose.toLowerCase().includes(q) ||
    loan.status.toLowerCase().includes(q) ||
    String(loan.termMonths).includes(q) ||
    (loan.amount / 100).toFixed(2).includes(q)
  );
});

const totalLoanPages = Math.max(1, Math.ceil(filteredLoans.length / LOAN_PAGE_SIZE));
const safeLoanPage = Math.min(loanPage, totalLoanPages);
const paginatedLoans = filteredLoans.slice(
  (safeLoanPage - 1) * LOAN_PAGE_SIZE,
  safeLoanPage * LOAN_PAGE_SIZE
);

const dashNavItems = [
  { id: "overview", label: "Overview & Wires", icon: "🏦", desc: "Balance, external transfers & history" },
  {
    id: "loans",
    label: "Loan Center",
    icon: "💳",
    desc: "Apply for credit & settle facilities",
    badge: loans.some((l) => l.status === "APPROVED") ? "Active" : undefined,
  },
  { id: "profile", label: "Account Profile & KYC", icon: "👤", desc: "Personal details, password & ID upload" },
  { id: "contact", label: "Support & Contact", icon: "📞", desc: "Compliance desk & treasury info" },
] as const;

const currentDashNav = dashNavItems.find((item) => item.id === dashTab)!;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value) || value === "") setAmount(value);
  };

async function handleInitialSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFeedback({});

    const formData = new FormData(e.currentTarget);
    const description = (formData.get("description") as string) || "";
    const result = await requestTransfer(
      recipientName,
      recipientAccountNo,
      recipientSystemName,
      routingNumber,
      amount,
      description
    );

    setLoading(false);
    if (result?.error) {
      setFeedback({ error: result.error });
    } else if (result?.success && result.txId) {
        if (saveAsBeneficiary) {
        await saveBeneficiary({
          accountName: recipientName,
          accountNo: recipientAccountNo,
          systemName: recipientSystemName,
          routingNo: routingNumber,
        });
      }
      setActiveTxId(result.txId);
    }
  }

  function handleSelectBeneficiary(b: BeneficiaryItem) {
  setRecipientName(b.accountName);
  setRecipientAccountNo(b.accountNo);
  setRecipientSystemName(b.systemName);
  setRoutingNumber(b.routingNo);
  setBeneficiaryMenuOpen(false);
  setBeneficiarySearch("");
}


  // Open modal when clicking a pending row in the history list
  async function handleResumePending(tx: TransactionItem) {
    setFeedback({});
    setModalFeedback("");
    setVerificationPin("");
    setActiveTxId(tx.id);
  }


  async function handleTokenVerify() {
    if (!activeTxId || !verificationPin) return;
    setLoading(true);
    setModalFeedback("");

    const result = await confirmTransfer(activeTxId, verificationPin);
    setLoading(false);

    if (result && "error" in result && result.error) {
      setModalFeedback(result.error);
    } else if (result && "success" in result) {
      setFeedback({ success: result.success });
      setActiveTxId(null);
      setVerificationPin("");
      setRecipientName("");
      setRecipientAccountNo("");
      setRecipientSystemName("");
      setRoutingNumber("");
      setSaveAsBeneficiary(false);
      if (formRef.current) formRef.current.reset();
      setAmount("");
    }
  }

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const q = beneficiarySearch.toLowerCase().trim();
    if (!q) return true;
    return (
      b.accountName.toLowerCase().includes(q) ||
      b.accountNo.toLowerCase().includes(q) ||
      b.systemName.toLowerCase().includes(q) ||
      b.routingNo.toLowerCase().includes(q)
    );
  });
  return (
    <div className="space-y-8">
      {/* Professional Banking Section Dropdown & Refresh */}
      <div className="flex items-center justify-between print:hidden">
        <div ref={dashMenuRef} className="relative inline-block text-left">
          <button
            type="button"
            onClick={() => setDashMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-between gap-4 bg-white hover:bg-slate-50 border border-slate-200/90 px-4 py-2.5 rounded-2xl shadow-xs transition min-w-[240px]"
          >
            <div className="flex items-center space-x-2.5">
              <span className="text-base">{currentDashNav.icon}</span>
              <div className="text-left">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                  Vault Section
                </span>
                <span className="text-xs font-bold text-slate-900 mt-0.5 block">
                  {currentDashNav.label}
                </span>
              </div>
            </div>
            <svg
              className={`h-4 w-4 text-slate-400 transition-transform duration-150 ${dashMenuOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dashMenuOpen && (
            <div className="absolute left-0 mt-2 w-72 origin-top-left rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-slate-900/10 p-1.5 z-30">
              {dashNavItems.map((item) => {
                const isActive = dashTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setDashTab(item.id);
                      setDashMenuOpen(false);
                    }}
                    className={`w-full flex items-start justify-between p-2.5 rounded-xl text-left transition ${
                      isActive ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-base mt-0.5">{item.icon}</span>
                      <div>
                        <p className="text-xs font-bold">{item.label}</p>
                        <p className={`text-[11px] mt-0.5 ${isActive ? "text-slate-300" : "text-slate-400"}`}>
                          {item.desc}
                        </p>
                      </div>
                    </div>
                    {"badge" in item && item.badge && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xs transition flex items-center space-x-2 disabled:opacity-60 print:hidden"
        >
          <span className={`inline-block ${refreshing ? "animate-spin" : ""}`}>🔄</span>
          <span>{refreshing ? "Syncing..." : "Refresh Data"}</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & Wires */}
      {dashTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start print:hidden">
          {/* Balance Card */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl flex flex-col justify-between h-52 border border-slate-800">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Net Account Balance</p>
              <h2 className="text-3xl font-black mt-2 tracking-tight">
                {formatCurrency(currentBalance / 100, currency)}
              </h2>
            </div>
            <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] tracking-wider font-mono text-slate-400">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-indigo-400 capitalize">
                  {userName}
                </span>
                <span className="text-indigo-300 text-sm font-black bg-slate-900/50 px-3 py-1 rounded select-all block mt-1 border border-slate-800 tracking-widest">
                  #{currentAccountNo}
                </span>
              </div>
              <span className="bg-slate-800 text-indigo-400 font-bold px-2 py-0.5 rounded border border-slate-700 uppercase">Active</span>
            </div>
          </div>
          {/* Transfer Form */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm print:hidden">
            {hasPending ? (
              <div className="py-8 text-center space-y-3">
                <span className="text-3xl block">⏳</span>
                <h3 className="text-base font-bold text-slate-900">Transfer Locked — Action Required</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  You have an unverified transfer waiting in your history below. Click the pending transaction to enter your authorization code or cancel it before starting a new transfer.
                </p>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleInitialSubmit} className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Instant Credit Wire</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Safely transfer directly to another account</p>
                </div>

                {feedback.error && <div className="bg-rose-50 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl border border-rose-100">⚠️ {feedback.error}</div>}
                {feedback.success && <div className="bg-emerald-50 text-emerald-700 text-xs font-medium px-4 py-3 rounded-xl border border-emerald-100">✅ {feedback.success}</div>}
              
                {/* Saved Beneficiaries Searchable Dropdown */}
                {beneficiaries.length > 0 && (
                  <div ref={beneficiaryMenuRef} className="relative">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Quick-Fill Saved Beneficiary
                    </label>
                    <button
                      type="button"
                      onClick={() => setBeneficiaryMenuOpen((prev) => !prev)}
                      className="w-full flex items-center justify-between border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 transition"
                    >
                      <span className="flex items-center space-x-2 truncate">
                        <span>📒</span>
                        <span className="truncate">
                          {recipientName
                            ? `${recipientName} (#${recipientAccountNo} • ${recipientSystemName})`
                            : `Select from ${beneficiaries.length} saved beneficiar${beneficiaries.length === 1 ? "y" : "ies"}...`}
                        </span>
                      </span>
                      <svg
                        className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-150 ${
                          beneficiaryMenuOpen ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {beneficiaryMenuOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 z-30 overflow-hidden">
                        {/* Search Bar inside Dropdown */}
                        <div className="p-2.5 border-b border-slate-100 bg-slate-50/60">
                          <div className="relative">
                            <input
                              type="text"
                              autoFocus
                              value={beneficiarySearch}
                              onChange={(e) => setBeneficiarySearch(e.target.value)}
                              placeholder="Search name, account #, bank, routing..."
                              className="w-full border border-slate-200 bg-white pl-3 pr-7 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium placeholder:text-slate-400"
                            />
                            {beneficiarySearch && (
                              <button
                                type="button"
                                onClick={() => setBeneficiarySearch("")}
                                className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Vertical Scrollable List */}
                        <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                          {filteredBeneficiaries.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">
                              No saved beneficiaries match "{beneficiarySearch}".
                            </div>
                          ) : (
                            filteredBeneficiaries.map((b) => (
                              <div
                                key={b.id}
                                className="flex items-center justify-between px-3.5 py-2.5 hover:bg-indigo-50/70 transition"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleSelectBeneficiary(b)}
                                  className="flex-1 text-left min-w-0 pr-2"
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-bold text-slate-900 truncate">
                                      {b.accountName}
                                    </span>
                                    <span className="text-[11px] font-mono font-semibold text-indigo-600 shrink-0">
                                      #{b.accountNo}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                    {b.systemName} • RTN: <span className="font-mono">{b.routingNo}</span>
                                  </p>
                                </button>

                                <button
                                  type="button"
                                  disabled={deletingBeneficiaryId === b.id}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setDeletingBeneficiaryId(b.id);
                                    await deleteBeneficiary(b.id);
                                    setDeletingBeneficiaryId(null);
                                  }}
                                  title="Remove beneficiary"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition shrink-0 flex items-center justify-center"
                                >
                                  {deletingBeneficiaryId === b.id ? (
                                    <span
                                      aria-label="Removing beneficiary"
                                      className="h-3.5 w-3.5 border-2 border-rose-200 border-t-rose-600 rounded-full animate-spin"
                                    />
                                  ) : (
                                    "🗑️"
                                  )}
                                </button>

                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}



                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Account Name <span className="text-red-500">*</span></label>
                    <input required value={recipientName} onChange={(e) => setRecipientName(e.target.value)} type="text" placeholder="e.g. Jane Doe" className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Account Number <span className="text-red-500">*</span></label>
                    <input required value={recipientAccountNo} onChange={(e) => setRecipientAccountNo(e.target.value)} type="text" placeholder="e.g. 90482716" className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono font-bold" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Bank Name <span className="text-red-500">*</span></label>
                    <input required value={recipientSystemName} onChange={(e) => setRecipientSystemName(e.target.value)} type="text" placeholder="e.g. Apex Bank" className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Routing Number <span className="text-red-500">*</span></label>
                    <input required value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} type="text" placeholder="e.g. 021000021" className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Amount <span className="text-red-500">*</span></label>
                    <input required name="amount" type="text" value={amount} onChange={handleAmountChange} placeholder={`${formatCurrency((currentBalance / 100), currency)}`} className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono font-bold" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Transaction Narrative / Memo</label>
                    <input name="description" type="text" placeholder="Personal payment, invoice..." className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium" />
                  </div>
                </div>

                  <label className="inline-flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAsBeneficiary}
                    onChange={(e) => setSaveAsBeneficiary(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-medium text-slate-600">
                    Save beneficiary details for faster future wires
                  </span>
                </label>

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center space-x-2"
                >
                  {loading && (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <span>{loading ? "Initiating Wire..." : "Authorize Transfer"}</span>
                </button>

              </form>
            )}
          </div>
          {/* Transaction History List */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden print:hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Transaction History</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click a pending wire to verify, or a settled row to view its receipt
                </p>
              </div>
              {/* Clean Client-Side Search Input (No URL query params) */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                placeholder="Search memo, recipient, acct #..."
                className="w-full border border-slate-200 bg-slate-50/70 pl-3 pr-7 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium placeholder:text-slate-400"
              />
              {historySearch && (
                <button
                      type="button"
                    onClick={() => {
                      setHistorySearch("");
                      setHistoryPage(1);
                    }}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {paginatedTransactions.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-400">
                  {historySearch
                    ? `No transactions match "${historySearch}".`
                    : "No transaction records found."}
                </div>
              ) : (
                paginatedTransactions.map((tx) => {
                  const isSender = tx.senderId === userId;
                  const isPending = tx.authCode !== null;

                  return (
                    <div
                        key={tx.id}
                        onClick={() => (isPending ? handleResumePending(tx) : setSelectedReceipt(tx))}
                        className={`px-6 py-4 flex justify-between items-center transition duration-150 cursor-pointer ${
                            isPending
                            ? "bg-amber-50/60 hover:bg-amber-100/70 border-l-4 border-amber-400"
                            : "hover:bg-slate-50"
                        }`}
                        >

                      <div className="flex items-center space-x-4">
                        <div
                          className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                            isPending
                              ? "bg-amber-100 text-amber-700 border border-amber-200"
                              : isSender
                              ? "bg-rose-50 text-rose-600 border border-rose-100"
                              : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          }`}
                        >
                          {isPending ? "⏳" : isSender ? "↓" : "↑"}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-bold text-slate-800 tracking-tight">{tx.description}</p>
                            {isPending && (
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                                Pending — Click to Verify
                              </span>
                            )}
                          </div>
                            <p className="text-xs text-slate-400 font-medium">
                                {isSender
                                ? `To: ${tx.recipientName} (#${tx.recipientAccountNo}) • ${tx.recipientSystemName} [RTN: ${tx.routingNumber}]`
                                : `From Account: #${tx.sender?.accountNo || "Unknown"}`}
                                <span className="mx-1.5 opacity-40">•</span>
                                {new Date(tx.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                })}
                          </p>

                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-sm font-extrabold tracking-tight font-mono ${
                            isPending ? "text-amber-700" : isSender ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          {isSender ? "-" : "+"}
                          {formatCurrency((tx.amount / 100), currency)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

             {totalHistoryPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <button
              type="button"
              disabled={safeHistoryPage <= 1}
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              className="text-xs font-bold px-4 py-2 border border-slate-200 rounded-xl bg-white shadow-2xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
            >
              ← Previous Page
            </button>
            <span className="text-xs text-slate-500 font-medium">
              Page <strong className="text-slate-800">{safeHistoryPage}</strong> of{" "}
              <strong className="text-slate-800">{totalHistoryPages}</strong> ({filteredTransactions.length} total)
            </span>
            <button
              type="button"
              disabled={safeHistoryPage >= totalHistoryPages}
              onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
              className="text-xs font-bold px-4 py-2 border border-slate-200 rounded-xl bg-white shadow-2xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
            >
              Next Page →
            </button>
          </div>
        )}
          </div>
        </div>
      )}
      
      {/* TAB 2: LOAN CENTER */}
      {dashTab === "loans" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Loan Application Card */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Apply for Credit Facility</h3>
              <p className="text-xs text-slate-400 mt-0.5">Instant underwriting with fixed repayment terms</p>
            </div>

            {loanFeedback.error && (
              <div className="bg-rose-50 text-rose-700 text-xs font-medium px-3.5 py-2.5 rounded-xl border border-rose-100">
                ⚠️ {loanFeedback.error}
              </div>
            )}
            {loanFeedback.success && (
              <div className="bg-emerald-50 text-emerald-700 text-xs font-medium px-3.5 py-2.5 rounded-xl border border-emerald-100">
                ✅ {loanFeedback.success}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoanLoading(true);
                setLoanFeedback({});
                const res = await applyForLoan(loanAmount, loanTerm, loanPurpose);
                setLoanLoading(false);
                if (res.error) setLoanFeedback({ error: res.error });
                if (res.success) {
                  setLoanFeedback({ success: res.success });
                  setLoanAmount("");
                  setLoanPurpose("");
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Principal Amount (Min 100.00)
                </label>
                <input
                  required
                  type="text"
                  value={loanAmount}
                  onChange={(e) => {
                    if (/^\d*\.?\d*$/.test(e.target.value) || e.target.value === "") {
                      setLoanAmount(e.target.value);
                    }
                  }}
                  placeholder="500.00"
                  className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Repayment Tenure
                </label>
                <select
                  value={loanTerm}
                  onChange={(e) => setLoanTerm(Number(e.target.value))}
                  className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl font-semibold"
                >
                  <option value={3}>3 Months (5.0% Fixed Interest)</option>
                  <option value={6}>6 Months (8.5% Fixed Interest)</option>
                  <option value={12}>12 Months (12.0% Fixed Interest)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Loan Purpose
                </label>
                <input
                  required
                  type="text"
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  placeholder="Equipment expansion, liquidity bridge..."
                  className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3.5 space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Interest Rate:</span>
                  <span className="font-mono font-bold text-slate-800">{ratePreview}%</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Total Repayment:</span>
                  <span className="font-mono font-black text-indigo-700">{formatCurrency(estimatedRepayment / 100, currency)}</span>
                </div>
              </div>

              <button
                disabled={loanLoading}
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold transition"
              >
                {loanLoading ? "Submitting Application..." : "Submit Loan Application"}
              </button>
            </form>
          </div>

          {/* Active & Historical Loans List */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Your Credit Facilities</h3>
                <p className="text-xs text-slate-400 mt-0.5">Track approval status and settle approved loans</p>
              </div>

              {/* Search Loan History */}
              <div className="relative w-full sm:w-60">
                <input
                  type="text"
                  value={loanSearch}
                  onChange={(e) => {
                    setLoanSearch(e.target.value);
                    setLoanPage(1);
                  }}
                  placeholder="Search purpose, status, amount..."
                  className="w-full border border-slate-200 bg-slate-50/70 pl-3 pr-7 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium placeholder:text-slate-400"
                />
                {loanSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setLoanSearch("");
                      setLoanPage(1);
                    }}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {paginatedLoans.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">
                {loanSearch
                  ? `No loan records match "${loanSearch}".`
                  : "You have no active or past loan applications."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {paginatedLoans.map((loan) => (
                  <div
                    key={loan.id}
                    className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{loan.purpose}</span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            loan.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : loan.status === "PENDING"
                              ? "bg-amber-100 text-amber-800"
                              : loan.status === "PAID"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {loan.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Principal:{" "}
                        <strong className="font-mono">{formatCurrency(loan.amount / 100, currency)}</strong> • Tenure:{" "}
                        <strong>{loan.termMonths} Months</strong> ({loan.interestRate}%)
                      </p>
                      <p className="text-xs text-slate-400">
                        Total Payoff:{" "}
                        <strong className="font-mono text-slate-800">
                          {formatCurrency(loan.totalPayable / 100, currency)}
                        </strong>
                      </p>
                    </div>

                    {loan.status === "APPROVED" && (
                      <button
                        type="button"
                        disabled={loanLoading}
                        onClick={async () => {
                          setLoanLoading(true);
                          setLoanFeedback({});
                          const res = await repayLoan(loan.id);
                          setLoanLoading(false);
                          if ("error" in res) setLoanFeedback({ error: res.error });
                          if ("success" in res) setLoanFeedback({ success: res.success });
                        }}
                        className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0"
                      >
                        {loanLoading ? "Processing..." : `Repay ${formatCurrency(loan.totalPayable / 100, currency)}`}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Loan History Pagination Footer */}
            {totalLoanPages > 1 && (
              <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button
                  type="button"
                  disabled={safeLoanPage <= 1}
                  onClick={() => setLoanPage((p) => Math.max(1, p - 1))}
                  className="text-xs font-bold px-3.5 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                >
                  ← Previous
                </button>
                <span className="text-xs text-slate-500 font-medium">
                  Page <strong className="text-slate-800">{safeLoanPage}</strong> of{" "}
                  <strong className="text-slate-800">{totalLoanPages}</strong> ({filteredLoans.length} total)
                </span>
                <button
                  type="button"
                  disabled={safeLoanPage >= totalLoanPages}
                  onClick={() => setLoanPage((p) => Math.min(totalLoanPages, p + 1))}
                  className="text-xs font-bold px-3.5 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 3: ACCOUNT PROFILE */}
      {dashTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Virtual Account Summary Card */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg">
                {(userName || "U").charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">{userName}</h4>
                <p className="text-xs text-slate-400 font-mono">{userEmail}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Routing Account No.</span>
                <span className="font-mono font-bold text-slate-900">#{currentAccountNo}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Account Tier</span>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                  {accountTier}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">KYC Status</span>
                {kycStatus === "PENDING" && <span className="font-bold text-amber-600">Pending Verification</span>}
                {kycStatus === "VERIFIED" && <span className="font-bold text-emerald-600">Verified</span>}
                {kycStatus === "REJECTED" && <span className="font-bold text-red-600">Verification Rejected</span>}
                {kycStatus === "UNVERIFIED" && <span className="font-bold text-slate-500">Not Verified</span>}
              </div>
              {/* Dedicated Account Officer Card */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                  Dedicated Account Officer
                </span>
                {accountOfficerName ? (
                  <div>
                    <p className="text-sm font-bold text-slate-900">{accountOfficerName}</p>
                    {accountOfficerEmail && (
                      <a
                        href={`mailto:${accountOfficerEmail}`}
                        className="text-xs font-mono text-indigo-700 hover:underline select-all"
                      >
                        {accountOfficerEmail}
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Pending assignment — contact compliance desk for assistance.
                  </p>
                )}
              </div>

            </div>
          </div>

          {/* Profile & Security Update Form + KYC Identity Verification */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal & Security Settings Card */}
            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Personal & Security Settings</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update your contact records or change your vault password
                </p>
              </div>

              {profileFeedback.error && (
                <div className="bg-rose-50 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl border border-rose-100">
                  ⚠️ {profileFeedback.error}
                </div>
              )}
              {profileFeedback.success && (
                <div className="bg-emerald-50 text-emerald-700 text-xs font-medium px-4 py-3 rounded-xl border border-emerald-100">
                  ✅ {profileFeedback.success}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setProfileLoading(true);
                  setProfileFeedback({});
                  const formData = new FormData(e.currentTarget);
                  const res = await updateProfile(formData);
                  setProfileLoading(false);
                  if (res.error) setProfileFeedback({ error: res.error });
                  if (res.success) setProfileFeedback({ success: res.success });
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Full Name
                    </label>
                    <input
                      required
                      name="name"
                      type="text"
                      defaultValue={userName}
                      className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Phone Number
                    </label>
                    <input
                      name="phone"
                      type="tel"
                      defaultValue={userPhone}
                      placeholder="+234 800 000 0000"
                      className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Residential / Billing Address
                  </label>
                  <input
                    name="address"
                    type="text"
                    defaultValue={userAddress}
                    placeholder="12 Marina Road, Lagos"
                    className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    New Password (Leave blank to keep current)
                  </label>
                  <div className="flex flex-row items-center space-x-2 text-xs text-gray-400 mb-1">
                    <span>Minimum 8 characters</span>
                    <span>•</span>
                    <span>Case-sensitive</span>
                  </div>
                  <div className="relative flex flex-row items-center mt-1">
                    <input
                      name="newPassword"
                      type={showPassword ? "text" : "password"}
                      minLength={8}
                      placeholder={showPassword ? "password" : "******"}
                      className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-xs font-semibold text-gray-500 hover:text-indigo-600 focus:outline-none select-none"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                    </div>
                </div>

                <button
                  disabled={profileLoading}
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition"
                >
                  {profileLoading ? "Saving Changes..." : "Save Profile Changes"}
                </button>
              </form>
            </div>
            {/* Two-Factor Authentication (2FA) Card */}
            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">Two-Factor Authentication (2FA)</h3>
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                      is2FAEnabled
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {is2FAEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Require a 6-digit verification code sent to <strong>{userEmail}</strong> every time you sign in.
                </p>
              </div>

              <button
                type="button"
                disabled={toggling2FA}
                onClick={async () => {
                  const nextState = !is2FAEnabled;
                  setToggling2FA(true);
                  setProfileFeedback({});
                  const res = await toggleTwoFactor(nextState);
                  setToggling2FA(false);
                  if (res.error) {
                    setProfileFeedback({ error: res.error });
                  } else if (res.success) {
                    setIs2FAEnabled(nextState);
                    setProfileFeedback({ success: res.success });
                  }
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center space-x-2 disabled:opacity-50 ${
                  is2FAEnabled
                    ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {toggling2FA && (
                  <span className="h-3.5 w-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                )}
                <span>
                  {toggling2FA
                    ? "Updating..."
                    : is2FAEnabled
                    ? "Disable 2FA"
                    : "Enable 2FA"}
                </span>
              </button>
            </div>

            {/* KYC Identity Verification Card */}
            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Identity Verification (KYC)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Upload a valid government-issued ID to verify your vault identity
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                    kycStatus === "VERIFIED"
                      ? "bg-emerald-100 text-emerald-800"
                      : kycStatus === "PENDING"
                      ? "bg-amber-100 text-amber-800"
                      : kycStatus === "REJECTED"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {kycStatus}
                </span>
              </div>

              {kycFeedback.error && (
                <div className="bg-rose-50 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl border border-rose-100">
                  ⚠️ {kycFeedback.error}
                </div>
              )}
              {kycFeedback.success && (
                <div className="bg-emerald-50 text-emerald-700 text-xs font-medium px-4 py-3 rounded-xl border border-emerald-100">
                  ✅ {kycFeedback.success}
                </div>
              )}

              {idDocumentUrl && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">
                      {idType} — <span className="font-mono">{idNumber}</span>
                    </span>
                    <span className="text-slate-400 text-[11px]">Submitted ID Document</span>
                  </div>
                  <a
                    href={idDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline font-bold"
                  >
                    View File ↗
                  </a>
                </div>
              )}

              {kycStatus !== "VERIFIED" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setKycLoading(true);
                    setKycFeedback({});
                    const formData = new FormData(e.currentTarget);
                    const res = await submitKycDocument(formData);
                    setKycLoading(false);
                    if (res.error) setKycFeedback({ error: res.error });
                    if (res.success) setKycFeedback({ success: res.success });
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Means of Identification
                      </label>
                      <select
                        required
                        name="idType"
                        defaultValue={idType || "PASSPORT"}
                        className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl font-medium"
                      >
                        <option value="PASSPORT">International Passport</option>
                        <option value="DRIVERS_LICENSE">Driver's License</option>
                        <option value="OTHERS">Others</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        ID Serial / Document Number
                      </label>
                      <input
                        required
                        name="idNumber"
                        type="text"
                        defaultValue={idNumber || ""}
                        placeholder="e.g. 12345678901"
                        className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Upload ID Image or PDF (Max 5MB)
                    </label>
                    <input
                      required
                      name="idFile"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="w-full border border-slate-200 bg-slate-50/50 p-2 text-xs rounded-xl file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>

                                     <button
                    disabled={kycLoading}
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition"
                  >
                    {kycLoading ? "Uploading Document..." : "Submit ID for Verification"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {/* TAB 4: CONTACT & COMPLIANCE SUPPORT */}
      {dashTab === "contact" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">{vaultName} Support & Compliance Desk</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Reach out to request wire authorization codes, KYC assistance, or account inquiries
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Compliance & Wire Email</span>
              <p className="text-sm font-bold text-slate-900 select-all">{settings.supportEmail}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Treasury Phone Desk</span>
              <p className="text-sm font-bold text-slate-900 select-all">{settings.supportPhone}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Operating Hours</span>
              <p className="text-sm font-semibold text-slate-800">{settings.operatingHours}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Headquarters Address</span>
              <p className="text-sm font-semibold text-slate-800">{settings.officeAddress}</p>
            </div>
            {/* Dedicated Account Officer Card */}
          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
              Dedicated Account Officer
            </span>
            {accountOfficerName ? (
              <div>
                <p className="text-sm font-bold text-slate-900">{accountOfficerName}</p>
                {accountOfficerEmail && (
                  <a
                    href={`mailto:${accountOfficerEmail}`}
                    className="text-xs font-mono text-indigo-700 hover:underline select-all"
                  >
                    {accountOfficerEmail}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Pending assignment — contact compliance desk for assistance.
              </p>
            )}
          </div>

          </div>

          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-950 space-y-1">
            <p className="font-bold">Need a Wire Authorization Code?</p>
            <p className="text-indigo-800/80">
              After initiating an external wire transfer, quote your Routing Account Number (<strong>#{currentAccountNo}</strong>) when contacting the compliance desk to receive your 6-digit release PIN.
            </p>
          </div>
        </div>
      )}


        {/* Authorization Modal */}
        {activeTxId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-5">
              <div className="text-center space-y-2">
                <div className="h-11 w-11 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto text-xl border border-indigo-100">
                  🛡️
                </div>
                <h4 className="text-base font-bold text-slate-900">Enter Security Vault PIN</h4>
                <p className="text-xs text-slate-400">
                  Enter your 6-digit authorization code to sign this wire transfer.
                </p>
              </div>

              {modalFeedback && (
                <div className="bg-rose-50 text-rose-700 text-xs font-medium px-3.5 py-2.5 rounded-xl border border-rose-100 text-center">
                  ❌ {modalFeedback}
                </div>
              )}

              {/* 
              {simulatedDisplayPin && secondsLeft > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <span className="block text-[10px] uppercase font-bold text-amber-600 tracking-wider">
                    Simulated Security PIN
                  </span>
                  <span className="text-lg font-black tracking-widest text-slate-800 select-all font-mono block mt-1">
                    {simulatedDisplayPin}
                  </span>
                </div>
              )}
              
              {secondsLeft === 0 ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleResendCode}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold transition"
                >
                  {loading ? "Generating..." : "🔄 Generate New 6-Digit PIN"}
                </button>
              ) : (
                <input
                  type="text"
                  maxLength={6}
                  value={verificationPin}
                  onChange={(e) => setVerificationPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full border border-slate-200 text-center tracking-[0.75em] text-xl font-bold font-mono py-2.5 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              )}
              */}
              <input
                  type="text"
                  maxLength={6}
                  value={verificationPin}
                  onChange={(e) => setVerificationPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full border border-slate-200 text-center tracking-[0.75em] text-xl font-bold font-mono py-2.5 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />

              <div className="flex space-x-2 pt-1">
                <button
                  type="button"
                  disabled={voiding || loading}
                  onClick={async () => {
                    setVoiding(true);
                    await cancelTransfer(activeTxId);
                    setVoiding(false);
                    setActiveTxId(null);
                    setVerificationPin("");
                    setModalFeedback("");
                  }}
                  className="flex-1 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed text-rose-700 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
                >
                  {voiding && (
                    <span className="h-3.5 w-3.5 border-2 border-rose-300 border-t-rose-700 rounded-full animate-spin" />
                  )}
                  <span>{voiding ? "Voiding..." : "Void Transfer"}</span>
                </button>

                <button
                  type="button"
                  disabled={voiding || loading}
                  onClick={() => {
                    setActiveTxId(null);
                    setVerificationPin("");
                    setModalFeedback("");
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition"
                >
                  Close Window
                </button>

                  <button
                    type="button"
                    disabled={verificationPin.length !== 6 || loading || voiding}
                    onClick={handleTokenVerify}
                    className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
                  >
                    {loading && (
                      <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    <span>{loading ? "Signing..." : "Verify"}</span>
                  </button>
                

              </div>
            </div>
          </div>
        )}
        {/* Printable Wire Receipt Modal */}
        {selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 print:bg-white print:p-0 print:static">
            <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-6 print:shadow-none print:border-slate-300 print:max-w-full">
              
              {/* Receipt Header */}
              <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                    {vaultName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{vaultName} Wire Receipt</h4>
                    <p className="text-[10px] font-mono text-slate-400 uppercase">Official Ledger Advice</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
                  Settled
                </span>
              </div>

              {/* Amount Highlight */}
              <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                  {selectedReceipt.senderId === userId ? "Total Debited" : "Total Credited"}
                </span>
                <span className="text-3xl font-black font-mono text-slate-900 mt-1 block">
                  {formatCurrency((selectedReceipt.amount / 100), currency)}
                </span>
              </div>

              {/* Itemized Wire Details */}
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Reference ID</span>
                  <span className="font-mono font-bold text-slate-800 uppercase">{selectedReceipt.id.slice(-12)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Date & Time</span>
                  <span className="font-medium text-slate-800">
                    {new Date(selectedReceipt.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {selectedReceipt.senderId === userId ? (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 font-medium">Beneficiary Name</span>
                      <span className="font-bold text-slate-800">{selectedReceipt.recipientName || "Internal Account"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 font-medium">Account Number</span>
                      <span className="font-mono font-bold text-slate-800">#{selectedReceipt.recipientAccountNo}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 font-medium">Destination Bank</span>
                      <span className="font-medium text-slate-800">{selectedReceipt.recipientSystemName || "Vault Bank"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 font-medium">Routing Number</span>
                      <span className="font-mono font-bold text-slate-800">{selectedReceipt.routingNumber || "N/A"}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">Origin Node</span>
                    <span className="font-mono font-bold text-slate-800">
                      {selectedReceipt.sender?.accountNo ? `#${selectedReceipt.sender.accountNo}` : "Unknown"}
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-1">
                  <span className="text-slate-400 font-medium">Memo / Narrative</span>
                  <span className="font-medium text-slate-800 text-right max-w-[200px]">{selectedReceipt.description}</span>
                </div>
              </div>

              {/* Action Buttons (Hidden when printing) */}
              <div className="flex space-x-3 pt-2 print:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  🖨️ Print / Save PDF
                </button>
              </div>

            </div>
          </div>
        )}
    </div>
  );
}