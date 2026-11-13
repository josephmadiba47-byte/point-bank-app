"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginUser(prevState: any, formData: FormData) {
  try {
    const accountNumber = formData.get("accountNumber") as string;
    const password = formData.get("password") as string;

    if (!accountNumber || !password) {
      return { error: "Please enter both your account number and password." };
    }
     // Call the Auth.js execution handler
    await signIn("credentials", {
      accountNumber,
      password,
      redirectTo: "/dashboard",
    });

    return { success: true };
  } catch (error) {
    // 1. ADD THIS LINE: Prints the internal error message to your terminal console!
    console.error("DEBUG AUTH ERROR:", error);

    if (error instanceof AuthError) {
      // Handle the generic error cases thrown inside authorize()
      if (error.cause?.err instanceof Error) {
        return { error: error.cause.err.message };
      }
      
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid account number or password credentials." };
        default:
          return { error: "Authentication system encountered an issue." };
      }
    }
    throw error;
  }
}