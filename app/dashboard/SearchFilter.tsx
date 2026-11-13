"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function SearchFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize input state with whatever search is currently sitting in the URL
  const [query, setQuery] = useState(searchParams.get("search") || "");

  useEffect(() => {
    // Debounce: Wait for 300ms of typing silence before updating URL parameters
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      
      if (query) {
        params.set("search", query);
      } else {
        params.delete("search");
      }
      
      // Reset to page 1 whenever a new search filter parameters routine begins
      params.set("page", "1");

      router.push(`/dashboard?${params.toString()}`);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, router, searchParams]);

  return (
    <div className="relative flex-1 max-w-md">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
        🔍
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by description, memo, or account number..."
        className="w-full border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150 font-medium placeholder:text-slate-400"
      />
      {query && (
        <button
          onClick={() => setQuery("")}
          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 text-xs transition font-semibold"
        >
          Clear
        </button>
      )}
    </div>
  );
}
