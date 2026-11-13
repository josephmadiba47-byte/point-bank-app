"use client";

import { useState, useRef, useEffect } from "react";
import { requestTransfer, confirmTransfer, cancelTransfer } from "@/app/actions/transfer";
import { formatCurrency } from "@/lib/utils";

interface Props {
  currentBalance: number;
}

export default function DashboardFormWrapper({ currentBalance }: Props) {
  // Navigation input state configurations
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$';
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});

  // Modal interception state management pipelines
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [verificationPin, setVerificationPin] = useState("");
  const [modalFeedback, setModalFeedback] = useState("");
  const [simulatedDisplayPin, setSimulatedDisplayPin] = useState(""); // Handy testing overlay

  const formRef = useRef<HTMLFormElement>(null);

  const [secondsLeft, setSecondsLeft] = useState(300);

useEffect(() => {
  if (!activeTxId) {
    setSecondsLeft(300);
    return;
  }

  const timer = setInterval(() => {
    setSecondsLeft((prev) => {
      if (prev <= 1) {
        clearInterval(timer);
        cancelTransfer(activeTxId);
        setActiveTxId(null);
        setVerificationPin("");
        setSimulatedDisplayPin("");
        setFeedback({ error: "Security PIN expired after 5 minutes. Please try again." });
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [activeTxId]);

const formattedTimer = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;


  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value) || value === "") setAmount(value);
  };

  // Stage 1 Action Trigger Handlers
  async function handleInitialSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFeedback({});

    const formData = new FormData(e.currentTarget);
    const accountNo = formData.get("accountNumber") as string;
    const desc = formData.get("description") as string;

    const result = await requestTransfer(accountNo, amount, desc);

    setLoading(false);
    if (result?.error) {
      setFeedback({ error: result.error });
    } else if (result?.success && result.txId) {
      setActiveTxId(result.txId);
      if (result.debugPin) setSimulatedDisplayPin(result.debugPin);
    }
  }
  

  // Stage 2 Token Code Signature Handlers
  async function handleTokenVerify() {
    if (!activeTxId || !verificationPin) return;
    setLoading(true);
    setModalFeedback("");

    const result = await confirmTransfer(activeTxId, verificationPin);
    setLoading(false);

    if (result && "error" in result) {
      setModalFeedback(result.error);
    } else if (result && "success" in result) {
      setFeedback({ success: result.success });
      // Close modal window overlay and reset states cleanly
      setActiveTxId(null);
      setVerificationPin("");
      setSimulatedDisplayPin("");
      if (formRef.current) formRef.current.reset();
      setAmount("");
    }
  }

  return (
    <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm shadow-slate-100/50 h-full flex flex-col justify-between relative">
      
      {/* Front facing routing wire entry parameters block layout */}
      <form ref={formRef} onSubmit={handleInitialSubmit} className="space-y-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Instant Credit Wire</h3>
          <p className="text-xs text-slate-400 mt-0.5">Safely send funds directly to another account</p>
        </div>
        
        {feedback.error && <div className="bg-rose-50 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl border border-rose-100">⚠️ {feedback.error}</div>}
        {feedback.success && <div className="bg-emerald-50 text-emerald-700 text-xs font-medium px-4 py-3 rounded-xl border border-emerald-100">✅ {feedback.success}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Recipient Account</label>
            <input required name="accountNumber" type="text" placeholder="e.g. 10000002" className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150 font-mono font-bold" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Amount</label>
            <input required name="amount" type="text" value={amount} onChange={handleAmountChange} placeholder={`${formatCurrency((currentBalance / 100),currency)}`} className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150 font-mono font-bold" />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Transaction Narrative / Memo</label>
          <input name="description" type="text" placeholder="Design production assets billing, core tip, etc." className="w-full border border-slate-200 bg-slate-50/50 p-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150 font-medium placeholder:text-slate-400" />
        </div>

        <button disabled={loading} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold transition duration-150 flex items-center justify-center">
          {loading ? "Validating Parameters..." : "Authorize Transfer"}
        </button>
      </form>

      {/* --- PREMIUM WIRE AUTHORIZATION INTERCEPT POPUP DIALOG MODAL --- */}
      {activeTxId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-6 transform scale-100 transition-all">
            
            <div className="text-center space-y-1.5">
              <div className="h-11 w-11 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto text-xl shadow-sm border border-indigo-100">
                🛡️
              </div>
              <h4 className="text-base font-bold text-slate-900 tracking-tight mt-3">Enter Security Vault PIN</h4>
              <p className="text-xs text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                A single-use 6-digit confirmation signature code was dispatched to compile this ledger transaction.
              </p>
            </div>
            <div className="inline-flex items-center space-x-1.5 bg-slate-100 text-slate-600 text-[11px] font-mono font-bold px-2.5 py-1 rounded-full">
              <span>⏱️ Expires in</span>
              <span className={secondsLeft <= 60 ? "text-rose-600" : "text-indigo-600"}>
                {formattedTimer}
              </span>
            </div>


            {/* Display validation errors inside the modal viewport block */}
            {modalFeedback && (
              <div className="bg-rose-50 text-rose-700 text-xs font-medium px-3.5 py-2.5 rounded-xl border border-rose-100 text-center">
                ❌ {modalFeedback}
              </div>
            )}

            {/* TESTING AID OVERLAY BANNER: Displays generated code right inside screen mockup context */}
            {/*
            {simulatedDisplayPin && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <span className="block text-[10px] uppercase font-bold text-amber-600 tracking-wider">Security SMS Code</span>
                <span className="text-lg font-black tracking-widest text-slate-800 select-all font-mono block mt-1">{simulatedDisplayPin}</span>
              </div>
            )}
            */}

            <div className="space-y-4">
              <input
                type="text"
                maxLength={6}
                value={verificationPin}
                onChange={(e) => setVerificationPin(e.target.value.replace(/\D/g, ""))}
                placeholder="0 0 0 0 0 0"
                className="w-full border border-slate-200 text-center tracking-[1em] text-xl font-bold font-mono py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-slate-400"
              />

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (activeTxId) {
                      await cancelTransfer(activeTxId);
                    }
                    setActiveTxId(null);
                    setVerificationPin("");
                    setModalFeedback("");
                    setSimulatedDisplayPin("");
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={verificationPin.length !== 6 || loading}
                  onClick={handleTokenVerify}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-40"
                >
                  {loading ? "Signing..." : "Sign Ledger"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
