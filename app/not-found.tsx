import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 font-sans antialiased text-slate-900">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-lg p-8 text-center space-y-6">
        <div className="space-y-2">
          <span className="inline-block text-xs font-mono font-bold uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full">
            Error 404
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight pt-1">
            Route Not Found
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            The ledger page or endpoint you requested does not exist or may have been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/dashboard"
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition"
          >
            Return to Vault
          </Link>
          <Link
            href="/login"
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl text-xs font-bold transition"
          >
            Sign In Screen
          </Link>
        </div>
      </div>
    </div>
  );
}
