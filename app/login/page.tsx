"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginUser } from "@/app/actions/login";
import { registerUser } from "@/app/actions/register";
import { formatCurrency } from "@/lib/utils";

export default function LoginPage() {
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$';
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);


  // Auth.js login hook binding
  const [loginState, loginAction] = useActionState(loginUser, null);

  // Form submission handler for account creation
  async function handleRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegisterError("");
    setRegisterSuccess(false);

    const formData = new FormData(event.currentTarget);
    const result = await registerUser(formData);

    if (result?.error) {
      setRegisterError(result.error);
    } else {
      setRegisterSuccess(true);
      // Auto toggle back to login form after 2 seconds
      setTimeout(() => {
        setIsRegistering(false);
        setRegisterSuccess(false);
      }, 2000);
    }
  }
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto w-full max-w-md">
        <div className="text-center">
          <span className="text-4xl">🪙</span>
          <h2 className="mt-4 text-3xl font-extrabold text-gray-900 tracking-tight">
            {isRegistering ? "Open an Account" : "Sign in to PointBank"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Instant wire transaction network
          </p>
        </div>
      </div>

      <div className="mt-8 mx-auto w-full max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-100">
          
          {/* Display Warning Banners */}
          {loginState?.error && (
            <div className="mb-4 bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-100">
              {loginState.error}
            </div>
          )}
          {registerError && (
            <div className="mb-4 bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-100">
              {registerError}
            </div>
          )}
          {registerSuccess && (
            <div className="mb-4 bg-green-50 text-green-700 text-sm p-3 rounded-lg border border-green-100">
              Account created! Awarding {formatCurrency(1000, currency)}...
            </div>
          )}

          {!isRegistering ? (
            /* --- SIGN IN FORM --- */
            <form action={loginAction} className="space-y-6">
              <div>
                 <label className="block text-sm font-medium text-gray-700">Account Number</label>
                <input required name="accountNumber" type="text" placeholder="10000002" className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="relative flex flex-row items-center mt-1">
                  <input
                    required
                    name="password"
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    placeholder={showPassword ? "password" : "******"}
                    className="block w-full border border-gray-300 rounded-lg pl-3 pr-14 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
              <SubmitButton label="Access Dashboard" />
            </form>
          ) : (
            /* --- REGISTER FORM --- */
            <form onSubmit={handleRegisterSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input required name="name" type="text" placeholder="John Doe" className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input required name="email" type="email" placeholder="you@domain.com" className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Create Vault Password</label>
                <div className="flex flex-row items-center space-x-2 text-xs text-gray-400 mb-1">
                  <span>Minimum 6 characters</span>
                  <span>•</span>
                  <span>Case-sensitive</span>
                </div>
                <div className="relative flex flex-row items-center mt-1">
                  <input
                    required
                    name="password"
                    type={showPassword2 ? "text" : "password"}
                    minLength={6}
                    placeholder={showPassword2 ? "password" : "******"}
                    className="block w-full border border-gray-300 rounded-lg pl-3 pr-14 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword2(!showPassword2)}
                    className="absolute right-3 text-xs font-semibold text-gray-500 hover:text-indigo-600 focus:outline-none select-none"
                  >
                    {showPassword2 ? "Hide" : "Show"}
                  </button>
                </div>

              </div>
              <SubmitButton label="Initialize Vault Profile" />
            </form>
          )}

          {/* Toggle Button */}
          {/*
          <div className="mt-6 text-center border-t border-gray-100 pt-4">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setRegisterError("");
              }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none"
            >
              {isRegistering
                ? "Already have a credit vault? Sign In"
                : `New here? Create account & claim ${formatCurrency(1000, currency)} free`}
            </button>
          </div>
            */}
        </div>
      </div>
    </div>
  );
}
// Reusable spinner-loading component when forms execute network requests
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      type="submit"
      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition"
    >
      {pending ? "Processing Vault Sync..." : label}
    </button>
  );
}
