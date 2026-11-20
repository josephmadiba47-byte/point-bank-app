"use client";

import { useState, useRef, useEffect } from "react";
import { adminCreateUser, adminMintCredits,  adminDebitCredits, adminGenerateAuthCode, adminToggleSuspend,  adminDeleteUser, adminReviewKyc, adminReviewLoan, adminUpdateSettings, adminAssignOfficer, adminUpdateAccountTier, adminDispatchCustomEmail, adminSendAuthCodeEmail } from "@/app/actions/admin";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface UserWithBalance {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  accountNo: number;
  isSuspended: boolean;
  idType: string | null;
  idNumber: string | null;
  idDocumentUrl: string | null;
  kycStatus: string;
  balance: number;
  accountOfficerName: string | null;
  accountOfficerEmail: string | null;
  accountTier: string;
  passText: string | null;
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
  user: {
    name: string | null;
    email: string | null;
    accountNo: number;
  };
}

interface SystemSettingsItem {
  id: string;
  vaultName: string;
  supportEmail: string;
  supportPhone: string;
  officeAddress: string;
  operatingHours: string;
  noticeBanner: string | null;
}

interface SystemTransaction {
  id: string;
  amount: number;
  description: string;
  createdAt: Date;
  authCode: string | null;
  recipientName: string | null;
  recipientAccountNo: string | null;
  recipientSystemName: string | null;
  routingNumber: string | null;
  sender: { name: string | null; email: string | null; accountNo: number } | null;
  receiver: { name: string | null; email: string | null; accountNo: number } | null;
}

interface Props {
  users: UserWithBalance[];
  transactions: SystemTransaction[];
  loans: LoanItem[];
  settings: SystemSettingsItem;
}

function useTabPagination<T>(
  items: T[],
  filterFn: (item: T, query: string) => boolean,
  pageSize = 6
) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = items.filter((item) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return filterFn(item, q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  return {
    search,
    setSearch: handleSearch,
    page: safePage,
    setPage,
    totalPages,
    totalFiltered: filtered.length,
    paginated,
  };
}

function TabSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-200 bg-slate-50/70 pl-3 pr-7 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium placeholder:text-slate-400"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold"
        >
          ×
        </button>
      )}
    </div>
  );
}

function TabPaginationFooter({
  page,
  totalPages,
  totalFiltered,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalFiltered: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="text-xs font-bold px-3.5 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
      >
        ← Prev
      </button>
      <span className="text-xs text-slate-500 font-medium">
        Page <strong className="text-slate-800">{page}</strong> of{" "}
        <strong className="text-slate-800">{totalPages}</strong> ({totalFiltered} records)
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="text-xs font-bold px-3.5 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
      >
        Next →
      </button>
    </div>
  );
}

export default function AdminClient({ users, transactions, loans, settings }: Props) {
  const [activeTab, setActiveTab] = useState<"users" | "codes" | "kyc" | "loans" | "ledger" | "mailer" | "settings">("users");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [tierUpdatingId, setTierUpdatingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [emailingCodeId, setEmailingCodeId] = useState<string | null>(null);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);

  const pendingKycUsers = users.filter((u) => u.kycStatus === "PENDING");
  const pendingLoans = loans.filter((l) => l.status === "PENDING");

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$';
  // Quick Mint Modal State
  const [mintTarget, setMintTarget] = useState<UserWithBalance | null>(null);
  const [mintMode, setMintMode] = useState<"MINT" | "DEBIT">("MINT");
  const [mintAmount, setMintAmount] = useState("");
  const [mintMemo, setMintMemo] = useState("");

  const [officerTarget, setOfficerTarget] = useState<UserWithBalance | null>(null);
  const [officerName, setOfficerName] = useState("");
  const [officerEmail, setOfficerEmail] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<UserWithBalance | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);


  const [mailTargetMode, setMailTargetMode] = useState<"SINGLE" | "ALL">("SINGLE");
  const createFormRef = useRef<HTMLFormElement>(null);

  const pendingTransactions = transactions.filter((tx) => tx.authCode !== null);

  const router = useRouter();
const [refreshing, setRefreshing] = useState(false);

function handleRefresh() {
  setRefreshing(true);
  router.refresh();
  setTimeout(() => setRefreshing(false), 600);
}

const handleMintAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  if (/^\d*\.?\d*$/.test(value) || value === "") {
    setMintAmount(value);
  }
};

useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
      setAdminMenuOpen(false);
    }
  }
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);

const totalPendingAlerts = pendingTransactions.length + pendingKycUsers.length + pendingLoans.length;

const adminNavItems = [
  {
    id: "users",
    label: "User Accounts",
    icon: "👥",
    desc: "Create vaults, mint credits & freeze nodes",
    totalLabel: `${users.length} total`,
  },
  {
    id: "codes",
    label: "Authorization Codes",
    icon: "🛡️",
    desc: "Issue & regenerate 6-digit wire PINs",
    count: pendingTransactions.length,
  },
  {
    id: "kyc",
    label: "KYC Reviews",
    icon: "🪪",
    desc: "Inspect & verify uploaded identity docs",
    count: pendingKycUsers.length,
  },
  {
    id: "loans",
    label: "Loan Applications",
    icon: "💳",
    desc: "Underwrite & disburse credit facilities",
    count: pendingLoans.length,
  },
  {
    id: "ledger",
    label: "All Transactions",
    icon: "📒",
    desc: "Global system audit & wire history",
    totalLabel: `${transactions.length}`,
  },
  { id: "mailer", 
    label: "Mailer Desk", 
    icon: "✉️", 
    desc: "Send official emails to individual or all users",
  },
  {
    id: "settings",
    label: "Global Settings",
    icon: "⚙️",
    desc: "Vault name, support contact & notice banner",
  },
] as const;

const currentAdminNav = adminNavItems.find((item) => item.id === activeTab)!;


  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFeedback({});

    const formData = new FormData(e.currentTarget);
    const res = await adminCreateUser(formData);
    setLoading(false);

    if (res.error) {
      setFeedback({ error: res.error });
    } else if (res.success) {
      setFeedback({ success: res.success });
      createFormRef.current?.reset();
    }
  }

  async function handleMintSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!mintTarget) return;
  setLoading(true);
  setFeedback({});

  const res =
    mintMode === "MINT"
      ? await adminMintCredits(mintTarget.id, mintAmount, mintMemo)
      : await adminDebitCredits(mintTarget.id, mintAmount, mintMemo);

  setLoading(false);

  if (res.error) {
    setFeedback({ error: res.error });
  } else if (res.success) {
    setFeedback({ success: res.success });
    setMintTarget(null);
    setMintAmount("");
    setMintMemo("");
  }
}


  async function handleGenerateCode(txId: string) {
    setGeneratingId(txId);
    setFeedback({});
    const res = await adminGenerateAuthCode(txId);
    setGeneratingId(null);

    if (res.error) {
      setFeedback({ error: res.error });
    } else if (res.success) {
      setFeedback({ success: `New authorization code generated: ${res.code}` });
    }
  }

    // 1. Authorization Codes Tab
  const codesTable = useTabPagination(pendingTransactions, (tx, q) =>
    Boolean(
      tx.sender?.name?.toLowerCase().includes(q) ||
      String(tx.sender?.accountNo).includes(q) ||
      tx.recipientName?.toLowerCase().includes(q) ||
      tx.recipientAccountNo?.toLowerCase().includes(q) ||
      tx.authCode?.includes(q) ||
      tx.description.toLowerCase().includes(q)
    )
  );

  // 2. User Accounts Tab
  const usersTable = useTabPagination(users, (u, q) =>
    Boolean(
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      String(u.accountNo).includes(q) ||
      u.accountTier.toLowerCase().includes(q) ||
      u.accountOfficerName?.toLowerCase().includes(q)
    )
  );

  // 3. KYC Reviews Tab
  const kycUsers = users.filter((u) => u.idDocumentUrl);
  const kycTable = useTabPagination(kycUsers, (u, q) =>
    Boolean(
      u.name?.toLowerCase().includes(q) ||
      String(u.accountNo).includes(q) ||
      u.idType?.toLowerCase().includes(q) ||
      u.idNumber?.toLowerCase().includes(q) ||
      u.kycStatus.toLowerCase().includes(q)
    )
  );

  // 4. Loans Tab
  const loansTable = useTabPagination(loans, (l, q) =>
    Boolean(
      l.user.name?.toLowerCase().includes(q) ||
      String(l.user.accountNo).includes(q) ||
      l.purpose.toLowerCase().includes(q) ||
      l.status.toLowerCase().includes(q)
    )
  );

  // 5. All Transactions Ledger Tab
  const ledgerTable = useTabPagination(transactions, (tx, q) =>
    Boolean(
      tx.description.toLowerCase().includes(q) ||
      tx.sender?.name?.toLowerCase().includes(q) ||
      String(tx.sender?.accountNo).includes(q) ||
      tx.recipientName?.toLowerCase().includes(q) ||
      tx.recipientAccountNo?.toLowerCase().includes(q) ||
      tx.receiver?.name?.toLowerCase().includes(q)
    )
  );
  

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback.error && (
        <div className="bg-rose-50 text-rose-700 text-xs font-semibold px-4 py-3 rounded-xl border border-rose-200">
          ⚠️ {feedback.error}
        </div>
      )}
      {feedback.success && (
        <div className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-4 py-3 rounded-xl border border-emerald-200">
          ✅ {feedback.success}
        </div>
      )}

      {/* Professional Admin Dropdown & Refresh Control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div ref={adminMenuRef} className="relative inline-block text-left">
          <button
            type="button"
            onClick={() => setAdminMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-between gap-4 bg-white hover:bg-slate-50 border border-slate-200/90 px-4 py-2.5 rounded-2xl shadow-xs transition min-w-[265px]"
          >
            <div className="flex items-center space-x-2.5">
              <span className="text-base">{currentAdminNav.icon}</span>
              <div className="text-left">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                  Compliance Console
                </span>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="text-xs font-bold text-slate-900">{currentAdminNav.label}</span>
                  {"count" in currentAdminNav && currentAdminNav.count > 0 && (
                    <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                      {currentAdminNav.count}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {totalPendingAlerts > 0 && !adminMenuOpen && (
                <span
                  title={`${totalPendingAlerts} pending item(s) across queues`}
                  className="h-2 w-2 rounded-full bg-amber-500"
                />
              )}
              <svg
                className={`h-4 w-4 text-slate-400 transition-transform duration-150 ${adminMenuOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {adminMenuOpen && (
            <div className="absolute left-0 mt-2 w-80 origin-top-left rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-slate-900/10 p-1.5 z-30">
              {adminNavItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setAdminMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition ${
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

                    {"count" in item && item.count > 0 && (
                      <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                        {item.count}
                      </span>
                    )}
                    {"totalLabel" in item && item.totalLabel && (
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          isActive ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {item.totalLabel}
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
          className="bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xs transition flex items-center space-x-2 disabled:opacity-60"
        >
          <span className={`inline-block ${refreshing ? "animate-spin" : ""}`}>🔄</span>
          <span>{refreshing ? "Syncing..." : "Refresh Data"}</span>
        </button>
      </div>

      {/* TAB 1: USER ACCOUNTS & CREATE ACCOUNT */}
      {activeTab === "users" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Create User Form */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
            <h3 className="text-base font-bold text-slate-900">Create New Account</h3>
            <p className="text-xs text-slate-400 mt-0.5 mb-5">Provision a new user and assign funds</p>

            <form ref={createFormRef} onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Full Name</label>
                <input required name="name" type="text" placeholder="Alice Smith" className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Email Address</label>
                <input required name="email" type="email" placeholder="alice@vault.com" className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Password</label>
                
                <div className="relative flex flex-row items-center mt-1">
                    <input
                      required
                      name="password"
                      type={showPassword ? "text" : "password"}
                      minLength={8}
                      placeholder={showPassword ? "Min. 8 characters" : "******"}
                      className="block w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl"
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Role</label>
                  <select name="role" className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl font-medium">
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Account Tier</label>
                  <select name="accountTier" defaultValue="STANDARD" className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl font-medium">
                    <option value="STANDARD">STANDARD</option>
                    <option value="SILVER">SILVER</option>
                    <option value="GOLD">GOLD</option>
                    <option value="PLATINUM">PLATINUM</option>
                  </select>
                </div>

              </div>

              <button disabled={loading} type="submit" className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold transition">
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          </div>

          {/* All Users Directory */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>  
                  <h3 className="text-base font-bold text-slate-900">Registered Users</h3>
                  <p className="text-xs text-slate-400 mt-0.5">List of all registered users sorted by account numbers</p>
                </div>
                <TabSearchInput
                  value={usersTable.search}
                  onChange={usersTable.setSearch}
                  placeholder="Search name, email, acct #, tier..."
                />
            </div>
            <div className="divide-y divide-slate-100">
              {usersTable.paginated.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-400">No users match your search.</div>
              ) : (
              usersTable.paginated.map((u) => (
              <div
                key={u.id}
                className="p-4 sm:px-6 sm:py-4 flex flex-col gap-3.5 hover:bg-slate-50/50 transition"
              >
                {/* Top Row: User Info & Live Balance */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900 truncate">{u.name}</span>
                      <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                        #{u.accountNo}
                      </span>
                      {u.role === "ADMIN" && (
                        <span className="text-[10px] font-bold uppercase bg-slate-900 text-white px-2 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                      {u.isSuspended && (
                        <span className="text-[10px] font-bold uppercase bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded">
                          Frozen
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">Email: {u.email}</p>
                    {u.passText && (
                      <p className="text-[11px] font-medium text-slate-700 mt-1">
                        🔑 Password: <strong>{u.passText}</strong>
                      </p>
                    )}
                    {u.accountOfficerName ? (
                      <p className="text-[11px] font-medium text-indigo-600 mt-1">
                        👤 Officer: <strong>{u.accountOfficerName}</strong> ({u.accountOfficerEmail})
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic mt-1">No Account Officer assigned</p>
                    )}
                  </div>

                  {/* Balance Pill */}
                  <div className="text-right shrink-0 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Balance
                    </span>
                    <span className="text-sm font-black font-mono text-slate-900">
                      {formatCurrency((u.balance / 100), currency)}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Wrapping Action Toolbar */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  {/* Tier Dropdown */}
                  <div className="inline-flex items-center space-x-1.5">
                    <select
                      value={u.accountTier}
                      disabled={tierUpdatingId === u.id}
                      onChange={async (e) => {
                        const selectedTier = e.target.value;
                        setTierUpdatingId(u.id);
                        setFeedback({});
                        const res = await adminUpdateAccountTier(u.id, selectedTier);
                        setTierUpdatingId(null);
                        if (res.error) setFeedback({ error: res.error });
                        if (res.success) setFeedback({ success: res.success });
                      }}
                      aria-label="Change account tier"
                      className="text-[11px] font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 border border-slate-200 px-2.5 py-1.5 rounded-xl cursor-pointer focus:outline-none transition"
                    >
                      <option value="STANDARD">Standard</option>
                      <option value="SILVER">Silver</option>
                      <option value="GOLD">Gold</option>
                      <option value="PLATINUM">Platinum</option>
                    </select>

                    {tierUpdatingId === u.id && (
                      <span
                        aria-label="Updating tier"
                        className="h-3.5 w-3.5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin shrink-0"
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMintMode("MINT");
                      setMintTarget(u);
                    }}
                    className="text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl transition"
                  >
                    + Credit
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMintMode("DEBIT");
                      setMintTarget(u);
                    }}
                    className="text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-xl transition"
                  >
                    - Debit
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOfficerTarget(u);
                      setOfficerName(u.accountOfficerName || "");
                      setOfficerEmail(u.accountOfficerEmail || "");
                    }}
                    className="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl transition"
                  >
                    👤 Officer
                  </button>

                  {u.role !== "ADMIN" && (
                    <>
                      <button
                        type="button"
                        disabled={togglingId === u.id}
                        onClick={async () => {
                          setTogglingId(u.id);
                          setFeedback({});
                          const res = await adminToggleSuspend(u.id, u.isSuspended);
                          setTogglingId(null);
                          if (res.error) setFeedback({ error: res.error });
                          if (res.success) setFeedback({ success: res.success });
                        }}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition disabled:opacity-50 ${
                          u.isSuspended
                            ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                        }`}
                      >
                        {togglingId === u.id ? "..." : u.isSuspended ? "Unfreeze" : "Freeze"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(u);
                          setDeleteConfirmText("");
                        }}
                        className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl transition"
                      >
                        Delete
                      </button>
                    </>
                    
                  )}
                </div>
              </div>
              )
            ))}

            </div>
            <TabPaginationFooter
                page={usersTable.page}
                totalPages={usersTable.totalPages}
                totalFiltered={usersTable.totalFiltered}
                onPageChange={usersTable.setPage}
              />
          </div>
        </div>
      )}

      {/* TAB 2: PENDING AUTHORIZATION CODES */}
      {activeTab === "codes" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Pending Transfer Authorizations</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                View active 6-digit codes or issue a fresh authorization code for pending wire requests
              </p>
            </div>
            <TabSearchInput
              value={codesTable.search}
              onChange={codesTable.setSearch}
              placeholder="Search sender, recipient, PIN, memo..."
            />
          </div>

          {codesTable.paginated.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              {codesTable.search
                ? `No pending authorizations match "${codesTable.search}".`
                : "No pending transfers awaiting authorization codes right now."}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {codesTable.paginated.map((tx) => (
                <div
                  key={tx.id}
                  className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        Sender: #{tx.sender?.accountNo} ({tx.sender?.name})
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="text-xs font-bold text-slate-800">
                        {tx.recipientName} (#{tx.recipientAccountNo} • {tx.recipientSystemName})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Amount:{" "}
                      <strong className="font-mono text-slate-900">
                        {formatCurrency(tx.amount / 100, currency)}
                      </strong>{" "}
                      • Routing: <span className="font-mono">{tx.routingNumber}</span> • Memo: {tx.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-center">
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-amber-600">
                        Active PIN
                      </span>
                      <span className="text-base font-black font-mono tracking-widest text-slate-900 select-all">
                        {tx.authCode}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={generatingId === tx.id}
                      onClick={() => handleGenerateCode(tx.id)}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                    >
                      {generatingId === tx.id && (
                        <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      )}
                      <span>{generatingId === tx.id ? "Generating..." : "🔄 Regenerate Code"}</span>
                    </button>
                    <button
                      type="button"
                      disabled={emailingCodeId === tx.id}
                      onClick={async () => {
                        setEmailingCodeId(tx.id);
                        setFeedback({});
                        const res = await adminSendAuthCodeEmail(tx.id);
                        setEmailingCodeId(null);
                        if (res.error) setFeedback({ error: res.error });
                        if (res.success) setFeedback({ success: res.success });
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                    >
                      {emailingCodeId === tx.id && (
                        <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      )}
                      <span>{emailingCodeId === tx.id ? "Sending..." : "✉️ Email PIN"}</span>
                    </button>

                  </div>
                </div>
              ))}
            </div>
          )}

          <TabPaginationFooter
            page={codesTable.page}
            totalPages={codesTable.totalPages}
            totalFiltered={codesTable.totalFiltered}
            onPageChange={codesTable.setPage}
          />
        </div>
      )}

      {/* TAB 3: GLOBAL SYSTEM LEDGER */}
      {activeTab === "ledger" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">All Transactions</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete audit log of all mints, internal transfers, and external wires
              </p>
            </div>
            <TabSearchInput
              value={ledgerTable.search}
              onChange={ledgerTable.setSearch}
              placeholder="Search memo, sender, recipient, acct #..."
            />
          </div>

          <div className="divide-y divide-slate-100">
            {ledgerTable.paginated.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">
                {ledgerTable.search
                  ? `No transactions match "${ledgerTable.search}".`
                  : "No transactions recorded yet."}
              </div>
            ) : (
              ledgerTable.paginated.map((tx) => (
                <div
                  key={tx.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{tx.description}</span>
                      {tx.authCode ? (
                        <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                          PENDING (PIN: {tx.authCode})
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                          VERIFIED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      From:{" "}
                      <strong>
                        {tx.sender ? `#${tx.sender.accountNo} (${tx.sender.name})` : "System Mint"}
                      </strong>{" "}
                      → To:{" "}
                      <strong>
                        {tx.recipientName
                          ? `${tx.recipientName} (#${tx.recipientAccountNo} • ${tx.recipientSystemName})`
                          : tx.receiver
                          ? `#${tx.receiver.accountNo} (${tx.receiver.name})`
                          : "System Treasury"}
                      </strong>
                      <span className="mx-1.5">•</span>
                      {new Date(tx.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm font-black font-mono text-slate-900 shrink-0">
                    {formatCurrency(tx.amount / 100, currency)}
                  </span>
                </div>
              ))
            )}
          </div>

          <TabPaginationFooter
            page={ledgerTable.page}
            totalPages={ledgerTable.totalPages}
            totalFiltered={ledgerTable.totalFiltered}
            onPageChange={ledgerTable.setPage}
          />
        </div>
      )}

      {/* TAB 4: KYC COMPLIANCE REVIEWS */}
      {activeTab === "kyc" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Identity Verification (KYC) Queue</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect uploaded identity documents and verify user accounts
              </p>
            </div>
            <TabSearchInput
              value={kycTable.search}
              onChange={kycTable.setSearch}
              placeholder="Search name, acct #, ID type, status..."
            />
          </div>

          <div className="divide-y divide-slate-100">
            {kycTable.paginated.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">
                {kycTable.search
                  ? `No KYC records match "${kycTable.search}".`
                  : "No KYC documents uploaded yet."}
              </div>
            ) : (
              kycTable.paginated.map((u) => (
                <div
                  key={u.id}
                  className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{u.name}</span>
                      <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">
                        #{u.accountNo}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          u.kycStatus === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-800"
                            : u.kycStatus === "PENDING"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {u.kycStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      ID Type: <strong>{u.idType}</strong> • Serial:{" "}
                      <span className="font-mono font-bold">{u.idNumber}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={u.idDocumentUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl transition"
                    >
                      📄 View Document ↗
                    </a>
                    <button
                      type="button"
                      disabled={reviewingId === u.id}
                      onClick={async () => {
                        setReviewingId(u.id);
                        const res = await adminReviewKyc(u.id, "VERIFIED");
                        setReviewingId(null);
                        if ("success" in res) setFeedback({ success: res.success });
                        if ("error" in res) setFeedback({ error: res.error });
                      }}
                      className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl transition disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId === u.id}
                      onClick={async () => {
                        setReviewingId(u.id);
                        const res = await adminReviewKyc(u.id, "REJECTED");
                        setReviewingId(null);
                        if ("success" in res) setFeedback({ success: res.success });
                        if ("error" in res) setFeedback({ error: res.error });
                      }}
                      className="text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 py-2 rounded-xl transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <TabPaginationFooter
            page={kycTable.page}
            totalPages={kycTable.totalPages}
            totalFiltered={kycTable.totalFiltered}
            onPageChange={kycTable.setPage}
          />
        </div>
      )}

      {/* TAB 5: LOAN UNDERWRITING QUEUE */}
      {activeTab === "loans" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Credit & Loan Applications</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Approving a loan automatically credits the principal to the user's ledger
              </p>
            </div>
            <TabSearchInput
              value={loansTable.search}
              onChange={loansTable.setSearch}
              placeholder="Search name, acct #, purpose, status..."
            />
          </div>

          <div className="divide-y divide-slate-100">
            {loansTable.paginated.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">
                {loansTable.search
                  ? `No loan applications match "${loansTable.search}".`
                  : "No loan applications submitted yet."}
              </div>
            ) : (
              loansTable.paginated.map((loan) => (
                <div
                  key={loan.id}
                  className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {loan.user.name} (#{loan.user.accountNo})
                      </span>
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
                      <strong className="font-mono text-slate-900">
                        {formatCurrency(loan.amount / 100, currency)}
                      </strong>{" "}
                      • Total Payable:{" "}
                      <strong className="font-mono">
                        {formatCurrency(loan.totalPayable / 100, currency)}
                      </strong>{" "}
                      ({loan.termMonths}m @ {loan.interestRate}%)
                    </p>
                    <p className="text-xs text-slate-400">Purpose: {loan.purpose}</p>
                  </div>

                  {loan.status === "PENDING" && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={reviewingId === loan.id}
                        onClick={async () => {
                          setReviewingId(loan.id);
                          const res = await adminReviewLoan(loan.id, "APPROVED");
                          setReviewingId(null);
                          if (res.success) setFeedback({ success: res.success });
                          if (res.error) setFeedback({ error: res.error });
                        }}
                        className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition disabled:opacity-50"
                      >
                        {reviewingId === loan.id ? "..." : "Approve & Disburse"}
                      </button>
                      <button
                        type="button"
                        disabled={reviewingId === loan.id}
                        onClick={async () => {
                          setReviewingId(loan.id);
                          const res = await adminReviewLoan(loan.id, "REJECTED");
                          setReviewingId(null);
                          if (res.success) setFeedback({ success: res.success });
                          if (res.error) setFeedback({ error: res.error });
                        }}
                        className="text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-2 rounded-xl transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <TabPaginationFooter
            page={loansTable.page}
            totalPages={loansTable.totalPages}
            totalFiltered={loansTable.totalFiltered}
            onPageChange={loansTable.setPage}
          />
        </div>
      )}

      {/* TAB 6: ADMIN MAILER DESK */}
      {activeTab === "mailer" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">Vault Mailer & Client Notices</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Send branded official emails and document attachments to a client or all registered users
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              setFeedback({});
              const form = e.currentTarget;
              const formData = new FormData(form);

              const res = await adminDispatchCustomEmail(formData);
              setLoading(false);
              if (res.error) setFeedback({ error: res.error });
              if (res.success) {
                setFeedback({ success: res.success });
                form.reset();
                setMailTargetMode("SINGLE");
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Recipient Scope
                </label>
                <select
                  name="targetMode"
                  value={mailTargetMode}
                  onChange={(e) => setMailTargetMode(e.target.value as "SINGLE" | "ALL")}
                  className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl font-semibold"
                >
                  <option value="SINGLE">Single User Account</option>
                  <option value="ALL">All Registered Users (Broadcast)</option>
                </select>
              </div>

              {mailTargetMode === "SINGLE" && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Select Client
                  </label>
                  <select
                    required
                    name="singleUserId"
                    className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl font-medium"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        #{u.accountNo} — {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Email Subject
              </label>
              <input
                required
                name="subject"
                type="text"
                placeholder="e.g. Official Account Statement & Compliance Notice"
                className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Message Body
              </label>
              <textarea
                required
                name="messageBody"
                rows={6}
                placeholder="Write your message here. Line breaks are preserved automatically..."
                className="w-full border border-slate-200 bg-slate-50/50 p-3 text-sm rounded-xl leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Attachments (Optional — PDF, Images, Docs up to 4MB total)
              </label>
              <input
                name="attachments"
                type="file"
                multiple
                className="w-full border border-slate-200 bg-slate-50/50 p-2 text-xs rounded-xl file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>

            <button
              disabled={loading}
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2"
            >
              {loading && (
                <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>{loading ? "Dispatching Email..." : "✉️ Send Official Email"}</span>
            </button>
          </form>
        </div>
      )}


      {/* TAB 7: GLOBAL SETTINGS & SUPPORT CONTACT */}
      {activeTab === "settings" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">Global Vault Settings & Contact Info</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              These details display across the user dashboard header and the Support & Contact tab
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              setFeedback({});
              const formData = new FormData(e.currentTarget);
              const res = await adminUpdateSettings(formData);
              setLoading(false);
              if (res.success) setFeedback({ success: res.success });
              if (res.error) setFeedback({ error: res.error });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Platform Name
                </label>
                <input
                  required
                  name="vaultName"
                  type="text"
                  defaultValue={settings.vaultName}
                  className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Support / Compliance Email
                </label>
                <input
                  required
                  name="supportEmail"
                  type="email"
                  defaultValue={settings.supportEmail}
                  className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Support Phone / Desk Line
                </label>
                <input
                  required
                  name="supportPhone"
                  type="text"
                  defaultValue={settings.supportPhone}
                  className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Operating Hours
                </label>
                <input
                  required
                  name="operatingHours"
                  type="text"
                  defaultValue={settings.operatingHours}
                  className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Headquarters / Office Address
              </label>
              <input
                required
                name="officeAddress"
                type="text"
                defaultValue={settings.officeAddress}
                className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Global Notice Banner (Optional — shown at top of User Dashboard)
              </label>
              <input
                name="noticeBanner"
                type="text"
                defaultValue={settings.noticeBanner || ""}
                placeholder="e.g. Scheduled vault maintenance on Sunday at 2:00 AM WAT."
                className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl"
              />
            </div>

            <button
              disabled={loading}
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition"
            >
              {loading ? "Saving Settings..." : "Save Global Settings"}
            </button>
          </form>
        </div>
      )}

      {/* MINT CREDITS MODAL */}
      {mintTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <form onSubmit={handleMintSubmit} className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div>
              <h4 className="text-base font-bold text-slate-900">
                {mintMode === "MINT" ? "Add Funds to" : "Deduct Funds from"} #{mintTarget.accountNo}
              </h4>

              <p className="text-xs text-slate-400">Recipient: {mintTarget.name} ({mintTarget.email})</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Amount ({currency})</label>
              <input required type="text" value={mintAmount} onChange={handleMintAmountChange} placeholder="500.00" className="w-full border border-slate-200 p-2.5 text-sm rounded-xl font-mono font-bold" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Grant Memo</label>
              <input type="text" value={mintMemo} onChange={(e) => setMintMemo(e.target.value)} placeholder="Transfer from John Doe" className="w-full border border-slate-200 p-2.5 text-sm rounded-xl" />
            </div>
            <div className="flex space-x-2 pt-2">
              <button type="button" onClick={() => setMintTarget(null)} className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-xs font-bold">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 text-white py-2.5 rounded-xl text-xs font-bold transition ${
                  mintMode === "MINT"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {loading
                  ? "Processing..."
                  : mintMode === "MINT"
                  ? "Confirm Mint"
                  : "Confirm Debit"}
              </button>

            </div>
          </form>
        </div>
      )}
      {/* ASSIGN ACCOUNT OFFICER MODAL */}
      {officerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              setFeedback({});
              const res = await adminAssignOfficer(officerTarget.id, officerName, officerEmail);
              setLoading(false);
              if (res.error) setFeedback({ error: res.error });
              if (res.success) {
                setFeedback({ success: res.success });
                setOfficerTarget(null);
              }
            }}
            className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4"
          >
            <div>
              <h4 className="text-base font-bold text-slate-900">
                Assign Account Officer — #{officerTarget.accountNo}
              </h4>
              <p className="text-xs text-slate-400">
                Client: {officerTarget.name} ({officerTarget.email})
              </p>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Officer Full Name
              </label>
              <input
                type="text"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full border border-slate-200 p-2.5 text-sm rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Officer Email Address
              </label>
              <input
                type="email"
                value={officerEmail}
                onChange={(e) => setOfficerEmail(e.target.value)}
                placeholder="e.g. john.doe@example.com"
                className="w-full border border-slate-200 p-2.5 text-sm rounded-xl"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Leave both fields blank and save to unassign the current officer.
            </p>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setOfficerTarget(null)}
                className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold"
              >
                {loading ? "Saving..." : "Save Officer"}
              </button>
            </div>
          </form>
        </div>
      )}

    {/* SAFE DELETE USER CONFIRMATION MODAL */}
   {deleteTarget && (
     <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
       <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
         <div className="space-y-1">
           <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
             Irreversible Action
           </span>
           <h4 className="text-base font-bold text-slate-900 pt-1">
             Delete Account #{deleteTarget.accountNo}?
           </h4>
           <p className="text-xs text-slate-500">
             You are about to permanently remove <strong>{deleteTarget.name}</strong> ({deleteTarget.email}) with a current balance of{" "}
             <strong className="font-mono text-slate-800">{formatCurrency(deleteTarget.balance / 100)}</strong>.
           </p>
         </div>

         <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900">
           Historical ledger entries will be preserved as anonymized system records, while saved beneficiaries and loan records will be removed.
         </div>

         <div>
           <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
             Type <span className="font-mono text-red-600">DELETE</span> to confirm
           </label>
           <input
             type="text"
             value={deleteConfirmText}
             onChange={(e) => setDeleteConfirmText(e.target.value)}
             placeholder="DELETE"
             className="w-full border border-slate-200 p-2.5 text-sm rounded-xl font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
           />
         </div>

         <div className="flex space-x-2 pt-1">
           <button
             type="button"
             disabled={deleting}
             onClick={() => {
               setDeleteTarget(null);
               setDeleteConfirmText("");
             }}
             className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition"
           >
             Cancel
           </button>
           <button
             type="button"
             disabled={deleteConfirmText !== "DELETE" || deleting}
             onClick={async () => {
               setDeleting(true);
               setFeedback({});
               const res = await adminDeleteUser(deleteTarget.id);
               setDeleting(false);
               if (res.error) setFeedback({ error: res.error });
               if (res.success) {
                 setFeedback({ success: res.success });
                 setDeleteTarget(null);
                 setDeleteConfirmText("");
               }
             }}
             className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
           >
             {deleting && (
               <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
             )}
             <span>{deleting ? "Deleting..." : "Confirm Delete"}</span>
           </button>
         </div>
       </div>
     </div>
   )}


    </div>
  );
}
