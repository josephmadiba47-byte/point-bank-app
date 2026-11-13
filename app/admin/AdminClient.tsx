"use client";

import { useState, useRef } from "react";
import { adminCreateUser, adminMintCredits, adminGenerateAuthCode, adminToggleSuspend } from "@/app/actions/admin";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface UserWithBalance {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  accountNo: number;
  balance: number;
  isSuspended: boolean;
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
}

export default function AdminClient({ users, transactions }: Props) {
  const [activeTab, setActiveTab] = useState<"users" | "codes" | "ledger">("codes");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$';
  // Quick Mint Modal State
  const [mintTarget, setMintTarget] = useState<UserWithBalance | null>(null);
  const [mintAmount, setMintAmount] = useState("");
  const [mintMemo, setMintMemo] = useState("");

  const createFormRef = useRef<HTMLFormElement>(null);

  const pendingTransactions = transactions.filter((tx) => tx.authCode !== null);

  const router = useRouter();
const [refreshing, setRefreshing] = useState(false);

function handleRefresh() {
  setRefreshing(true);
  router.refresh();
  setTimeout(() => setRefreshing(false), 600);
}

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

    const res = await adminMintCredits(mintTarget.id, mintAmount, mintMemo);
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

            {/* Navigation Tabs & Refresh Control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs w-fit">
          <button
            onClick={() => setActiveTab("codes")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === "codes" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>🛡️ Authorization Codes</span>
            {pendingTransactions.length > 0 && (
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                {pendingTransactions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "users" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            👥 User Accounts ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "ledger" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            📒 All Transactions ({transactions.length})
          </button>
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


      {/* TAB 1: PENDING AUTHORIZATION CODES */}
      {activeTab === "codes" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Pending Transfer Authorizations</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              View active 6-digit codes or issue a fresh authorization code for pending wire requests
            </p>
          </div>

          {pendingTransactions.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              No pending transfers awaiting authorization codes right now.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingTransactions.map((tx) => (
                <div key={tx.id} className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        Sender: #{tx.sender?.accountNo} ({tx.sender?.name})
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="text-xs font-bold text-slate-800">
                        {tx.recipientName} (#{tx.recipientAccountNo} • {tx.recipientSystemName})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Amount: <strong className="font-mono text-slate-900">{formatCurrency((tx.amount / 100), currency)}</strong> • Routing: <span className="font-mono">{tx.routingNumber}</span> • Memo: {tx.description}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-center">
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-amber-600">Active PIN</span>
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USER ACCOUNTS & CREATE ACCOUNT */}
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
                <input required name="password" type="password" minLength={6} placeholder="Min. 6 characters" className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl" />
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
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Starting Balance</label>
                  <input name="initialDeposit" type="number" step="0.01" min="0" defaultValue="1000" className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl font-mono font-bold" />
                </div>
              </div>

              <button disabled={loading} type="submit" className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold transition">
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          </div>

          {/* All Users Directory */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Registered Users</h3>
              <p className="text-xs text-slate-400 mt-0.5">Live balances across all system nodes</p>
            </div>
            <div className="divide-y divide-slate-100">
              {users.map((u) => (
                <div key={u.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-900">{u.name}</span>
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

                    <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                  </div>

                  <div className="flex items-center space-x-2">
                <div className="text-right mr-2">
                  <span className="text-sm font-black font-mono text-slate-900">
                    {formatCurrency((u.balance / 100), currency)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMintTarget(u)}
                  className="text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl transition"
                >
                  + Add Funds
                </button>
                {u.role !== "ADMIN" && (
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
                )}
              </div>

                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GLOBAL SYSTEM LEDGER */}
      {activeTab === "ledger" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">All Transactions</h3>
            <p className="text-xs text-slate-400 mt-0.5">Complete audit log of all mints, internal transfers, and external wires</p>
          </div>
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => (
              <div key={tx.id} className="px-6 py-4 flex justify-between items-center hover:bg-slate-50/50">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
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
                    From: <strong>{tx.sender ? `#${tx.sender.accountNo} (${tx.sender.name})` : ""}</strong> → To:{" "}
                    <strong>
                      {tx.recipientName
                        ? `${tx.recipientName} (#${tx.recipientAccountNo} • ${tx.recipientSystemName})`
                        : `#${tx.receiver?.accountNo} (${tx.receiver?.name})`}
                    </strong>
                    <span className="mx-1.5">•</span>
                    {new Date(tx.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-sm font-black font-mono text-slate-900">
                  {formatCurrency((tx.amount / 100), currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MINT CREDITS MODAL */}
      {mintTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <form onSubmit={handleMintSubmit} className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div>
              <h4 className="text-base font-bold text-slate-900">Add Funds to #{mintTarget.accountNo}</h4>
              <p className="text-xs text-slate-400">Recipient: {mintTarget.name} ({mintTarget.email})</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Amount ({currency})</label>
              <input required type="number" step="0.01" min="0.01" value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} placeholder="500.00" className="w-full border border-slate-200 p-2.5 text-sm rounded-xl font-mono font-bold" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Grant Memo</label>
              <input type="text" value={mintMemo} onChange={(e) => setMintMemo(e.target.value)} placeholder="Transfer from John Doe" className="w-full border border-slate-200 p-2.5 text-sm rounded-xl" />
            </div>
            <div className="flex space-x-2 pt-2">
              <button type="button" onClick={() => setMintTarget(null)} className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-xs font-bold">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold">
                {loading ? "Minting..." : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
