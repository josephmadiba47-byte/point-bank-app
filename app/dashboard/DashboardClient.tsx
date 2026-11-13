"use client";

import { useState, useRef, useEffect } from "react";
import { requestTransfer, confirmTransfer, cancelTransfer, regenerateTransferCode } from "@/app/actions/transfer";
import SearchFilter from "./SearchFilter";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { saveBeneficiary, deleteBeneficiary } from "../actions/beneficiary";

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

interface Props {
  userId: string;
  userName?: string;
  currentBalance: number;
  currentAccountNo: number | string;
  transactions: TransactionItem[];
  beneficiaries: BeneficiaryItem[];
  hasPending: boolean;
  currentPage: number;
  totalPages: number;
  totalTransactions: number;
  searchQuery: string;
}

export default function DashboardClient({
  userId,
  userName,
  currentBalance,
  currentAccountNo,
  transactions,
  beneficiaries,
  hasPending,
  currentPage,
  totalPages,
  totalTransactions,
  searchQuery,
}: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});

  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [verificationPin, setVerificationPin] = useState("");
  const [modalFeedback, setModalFeedback] = useState("");
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$';
  const [selectedReceipt, setSelectedReceipt] = useState<TransactionItem | null>(null);

  const [recipientName, setRecipientName] = useState("");
  const [recipientAccountNo, setRecipientAccountNo] = useState("");
  const [recipientSystemName, setRecipientSystemName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [saveAsBeneficiary, setSaveAsBeneficiary] = useState(false);
  const [beneficiarySearch, setBeneficiarySearch] = useState("");


  const formRef = useRef<HTMLFormElement>(null);

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

  const buildPageUrl = (pageNumber: number) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    params.set("page", pageNumber.toString());
    return `/dashboard?${params.toString()}`;
  };

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl flex flex-col justify-between h-52 border border-slate-800">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Net Account Balance</p>
            <h2 className="text-4xl font-black mt-2 tracking-tight">
              {formatCurrency(currentBalance / 100, currency)}
            </h2>
          </div>
          <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] tracking-wider font-mono text-slate-400">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-indigo-400 capitalize">
                {userName}
              </span>
              <span className="text-indigo-300 text-sm font-black bg-slate-900/50 px-3 py-1 rounded select-all block mt-1 border border-slate-800 tracking-widest">
                {currentAccountNo}
              </span>
            </div>
            <span className="bg-slate-800 text-indigo-400 font-bold px-2 py-0.5 rounded border border-slate-700 uppercase">Active</span>
          </div>
        </div>

        {/* Transfer Form */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
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
            
              {/* Saved Beneficiaries Quick-Fill & Search Bar */}
              {beneficiaries.length > 0 && (
                <div className="space-y-2.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Saved Beneficiaries ({filteredBeneficiaries.length})
                    </span>
                    <div className="relative w-full sm:w-56">
                      <input
                        type="text"
                        value={beneficiarySearch}
                        onChange={(e) => setBeneficiarySearch(e.target.value)}
                        placeholder="Search name, acct, vault..."
                        className="w-full border border-slate-200 bg-white pl-2.5 pr-7 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium placeholder:text-slate-400"
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
                  {filteredBeneficiaries.length === 0 ? (
                    <p className="text-xs text-slate-400 py-1">
                      No saved beneficiaries match "{beneficiarySearch}".
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
                      {filteredBeneficiaries.map((b) => (
                        <div
                          key={b.id}
                          className="inline-flex items-center bg-white hover:bg-indigo-50 border border-indigo-200/80 rounded-xl text-xs shadow-2xs transition"
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectBeneficiary(b)}
                            className="px-3 py-1.5 font-semibold text-indigo-950 flex items-center space-x-1.5 text-left"
                          >
                            <span>{b.accountName}</span>
                            <span className="text-[10px] font-mono text-indigo-600">#{b.accountNo}</span>
                            <span className="text-[10px] text-slate-400 hidden md:inline">• {b.systemName}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteBeneficiary(b.id)}
                            title="Remove beneficiary"
                            className="pr-2.5 pl-1 py-1.5 text-slate-400 hover:text-rose-600 font-bold"
                          >
                            ×
                          </button>
                        </div>
                      ))}
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
      </div>

        {/* Transaction History List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Transaction History</h3>
            <p className="text-xs text-slate-400 mt-0.5">Click any pending transaction to complete authorization</p>
          </div>
          <SearchFilter />
        </div>

        <div className="divide-y divide-slate-100">
          {transactions.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">No transaction records found.</div>
          ) : (
            transactions.map((tx) => {
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

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <Link
              href={buildPageUrl(currentPage - 1)}
              className={`text-xs font-bold px-4 py-2 border rounded-xl bg-white shadow-sm ${
                currentPage <= 1 ? "opacity-40 pointer-events-none text-slate-400" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              ← Previous Page
            </Link>
            <span className="text-xs text-slate-500 font-medium">
              Page {currentPage} of {totalPages} ({totalTransactions} total)
            </span>
            <Link
              href={buildPageUrl(currentPage + 1)}
              className={`text-xs font-bold px-4 py-2 border rounded-xl bg-white shadow-sm ${
                currentPage >= totalPages ? "opacity-40 pointer-events-none text-slate-400" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              Next Page →
            </Link>
          </div>
        )}
      </div>

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
                  P
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">PointVault Wire Receipt</h4>
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
                {(selectedReceipt.amount / 100).toFixed(2)} <span className="text-sm font-bold text-slate-500">PTS</span>
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
                    <span className="text-slate-400 font-medium">Destination Vault</span>
                    <span className="font-medium text-slate-800">{selectedReceipt.recipientSystemName || "PointVault"}</span>
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
