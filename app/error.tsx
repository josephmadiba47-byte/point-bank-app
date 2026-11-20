"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Vault Runtime Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 font-sans antialiased text-slate-900">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-lg p-8 text-center space-y-6">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center text-xl">
          ⚠️
        </div>

        <div className="space-y-2">
          <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-widest bg-rose-50 text-rose-700 border border-rose-100 px-3 py-1 rounded-full">
            Service Interruption
          </span>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight pt-1">
            Unable to Load Vault Session
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            A temporary network or ledger synchronization issue occurred. Your funds and records remain safe.
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-slate-400 pt-1">
              Reference ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition"
          >
            🔄 Retry Connection
          </button>
          <Link
            href="/login"
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl text-xs font-bold transition"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
