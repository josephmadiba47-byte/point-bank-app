"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { registerUser } from "@/app/actions/register";
import { initiateSecureLogin, requestPasswordReset } from "@/app/actions/security";

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<"login" | "register" | "forgot" | "2fa">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Hold credentials in state between Step 1 (Password) and Step 2 (2FA OTP)
  const [loginAccountNumber, setLoginAccountNumber] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");

  const [rememberMe, setRememberMe] = useState(false);

useEffect(() => {
  const savedAccountNumber = localStorage.getItem("vault_remembered_account_number");
  if (savedAccountNumber) {
    setLoginAccountNumber(savedAccountNumber);
    setRememberMe(true);
  }
}, []);

function persistRememberedDevice() {
  if (rememberMe) {
    localStorage.setItem("vault_remembered_account_number", loginAccountNumber.trim());
  } else {
    localStorage.removeItem("vault_remembered_account_number");
  }
}

  async function handleLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    // Step 1: Verify credentials, send 2FA OTP if enabled, and check device
    const check = await initiateSecureLogin(loginAccountNumber, loginPassword);

    if (check.error) {
      setLoading(false);
      setError(check.error);
      return;
    }

    if (check.requires2FA) {
      setLoading(false);
      setTwoFactorCode("");
      setView("2fa");
      return;
    }

    // If 2FA is disabled, sign in directly
    const result = await signIn("credentials", {
      accountNumber: loginAccountNumber,
      password: loginPassword,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Authentication failed. Please try again.");
    } else {
      persistRememberedDevice();
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handle2FASubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      accountNumber: loginAccountNumber,
      password: loginPassword,
      twoFactorCode,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Invalid or expired 6-digit verification code.");
    } else {
      persistRememberedDevice();
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    const res = await requestPasswordReset(forgotEmail);
    setLoading(false);

    if (res.error) setError(res.error);
    if (res.success) setSuccessMsg(res.success);
  }

  async function handleRegisterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    const formData = new FormData(e.currentTarget);
    const result = await registerUser(formData);

    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setView("login");
      setLoginAccountNumber(String(result.accountNo));
      setSuccessMsg(`Account #${result.accountNo} created! Your credentials have been emailed to you. Please sign in to access your vault.`);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {view === "register"
              ? "Create an Account"
              : view === "forgot"
              ? "Recover Password"
              : view === "2fa"
              ? "Two-Factor Verification"
              : "Sign In to Your Vault"}
          </h1>
          <p className="text-sm text-gray-500">
            {view === "register"
              ? "Open a secure point-credit ledger account"
              : view === "forgot"
              ? "We will send a password reset link to your email"
              : view === "2fa"
              ? `Enter the 6-digit code sent to the email linked to #${loginAccountNumber}`

              : "Access your account balance and transfers"}
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 text-red-600 text-xs font-medium p-3 rounded-lg border border-red-100">
            ⚠️ {error}
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 text-emerald-700 text-xs font-medium p-3 rounded-lg border border-emerald-100">
            ✅ {successMsg}
          </div>
        )}

        {/* VIEW 1: LOGIN */}
        {view === "login" && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Account Number</label>
              <input
                  required
                  name="accountNumber"
                  type="text"
                  inputMode="numeric"
                  value={loginAccountNumber}
                  onChange={(e) => setLoginAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="12345678"
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setSuccessMsg("");
                    setForgotEmail("");
                    setView("forgot");
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative flex items-center mt-1">
                <input
                  required
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full border border-gray-300 rounded-lg pl-3 pr-14 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-xs font-semibold text-gray-500 hover:text-indigo-600 select-none"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-medium text-gray-600">
                Remember me on this device
              </span>
            </label>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center space-x-2"
            >
              {loading && (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>{loading ? "Verifying..." : "Sign In"}</span>
            </button>
          </form>
        )}

        {/* VIEW 2: 2FA CODE VERIFICATION */}
        {view === "2fa" && (
          <form onSubmit={handle2FASubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 text-center mb-2">
                6-Digit Security Code
              </label>
              <input
                required
                type="text"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full border border-gray-300 text-center tracking-[0.75em] text-2xl font-bold font-mono py-3 rounded-xl bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              disabled={loading || twoFactorCode.length !== 6}
              type="submit"
              className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center space-x-2"
            >
              {loading && (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>{loading ? "Authenticating..." : "Verify & Enter Vault"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setView("login");
                setTwoFactorCode("");
                setError("");
              }}
              className="w-full text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              ← Back to Login
            </button>
          </form>
        )}

        {/* VIEW 3: FORGOT PASSWORD */}
        {view === "forgot" && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Registered Email</label>
              <input
                required
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@domain.com"
                className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center space-x-2"
            >
              {loading && (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>{loading ? "Sending Link..." : "Send Reset Link"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setView("login");
                setError("");
                setSuccessMsg("");
              }}
              className="w-full text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* VIEW 4: REGISTER */}
        {view === "register" && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                required
                name="name"
                type="text"
                placeholder="Jane Doe"
                className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                required
                name="email"
                type="email"
                placeholder="you@domain.com"
                className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Account Tier</label>
              <select
                name="accountTier"
                defaultValue="STANDARD"
                className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="STANDARD">Standard Vault</option>
                <option value="SILVER">Silver Private</option>
                <option value="GOLD">Gold Premier</option>
                <option value="PLATINUM">Platinum Corporate</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative flex items-center mt-1">
                <input
                  required
                  name="password"
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className="block w-full border border-gray-300 rounded-lg pl-3 pr-14 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-xs font-semibold text-gray-500 hover:text-indigo-600 select-none"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center space-x-2"
            >
              {loading && (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>{loading ? "Creating Account..." : "Create Account"}</span>
            </button>
          </form>
        )}

        {/* Footer Switcher */}
        {/*
        {(view === "login" || view === "register") && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setView(view === "login" ? "register" : "login");
                setError("");
                setSuccessMsg("");
              }}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              {view === "register"
                ? "Already have an account? Sign In"
                : "New here? Create a vault account"}
            </button>
          </div>
        )}
          */}
      </div>
    </div>
  );
}
