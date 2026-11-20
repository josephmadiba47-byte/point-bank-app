import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserBalance } from "@/lib/ledger";
import DashboardClient from "./DashboardClient";
import Link from "next/link";

export const instant = false;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id!;
  const currentBalance = await getUserBalance(userId);

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountNo: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      address: true,
      idType: true,
      idNumber: true,
      idDocumentUrl: true,
      kycStatus: true,
      accountOfficerName: true,
      accountOfficerEmail: true,
      accountTier: true,
      twoFactorEnabled: true,
    },
  });

  const loans = await prisma.loan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  // Check if the user currently has an unverified outgoing transfer
  const pendingTransfer = await prisma.transaction.findFirst({
    where: { senderId: userId, authCode: { not: null } },
  });

  const beneficiaries = await prisma.beneficiary.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const settings = await prisma.systemSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });

  const vaultName = settings.vaultName || process.env.NEXT_PUBLIC_SITE_NAME || "PointVault";

  // Fetch recent completed transactions (sent or received) PLUS the user's own pending outgoing transfers
  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [
        { senderId: userId },
        { receiverId: userId, authCode: null },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      sender: { select: { accountNo: true } },
      receiver: { select: { accountNo: true } },
    },
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] antialiased text-slate-900 font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-indigo-200">
              {vaultName.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="text-base font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                {vaultName}
              </span>
              <span className="text-[10px] block font-mono text-slate-400 font-medium tracking-wider uppercase -mt-0.5">
                Instant Wire Transaction
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {dbUser?.role === "ADMIN" && (
              <Link
                href="/admin"
                className="text-xs font-bold text-white bg-slate-900 hover:bg-indigo-600 px-3.5 py-2 rounded-xl transition duration-200 shadow-xs"
              >
                🛡️ Admin Console
              </Link>
            )}
            <a
              href="/api/auth/signout"
              className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-red-50 hover:text-red-600 px-3.5 py-2 rounded-xl transition duration-200"
            >
              Sign Out
            </a>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {settings.noticeBanner && (
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-3 rounded-2xl shadow-sm flex items-center justify-between gap-3 print:hidden">
            <div className="flex items-center space-x-3">
              <span className="text-base shrink-0">📢</span>
              <p className="text-xs sm:text-sm font-medium leading-snug">
                {settings.noticeBanner}
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-white/15 px-2.5 py-1 rounded-full shrink-0 hidden sm:inline-block">
              Notice
            </span>
          </div>
        )}

        <DashboardClient
          userId={userId}
          userName={dbUser?.name || ""}
          userEmail={dbUser?.email || ""}
          userPhone={dbUser?.phone || ""}
          userAddress={dbUser?.address || ""}
          currentBalance={currentBalance}
          currentAccountNo={dbUser?.accountNo || "Pending"}
          transactions={transactions}
          beneficiaries={beneficiaries}
          loans={loans}
          hasPending={!!pendingTransfer}
          idType={dbUser?.idType || ""}
          idNumber={dbUser?.idNumber || ""}
          idDocumentUrl={dbUser?.idDocumentUrl || ""}
          kycStatus={(dbUser?.kycStatus || "UNVERIFIED") as "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED"}
          accountTier={dbUser?.accountTier || "STANDARD"}
          settings={settings}
          accountOfficerEmail={dbUser?.accountOfficerEmail || ""}
          accountOfficerName={dbUser?.accountOfficerName || ""}
          twoFactorEnabled={dbUser?.twoFactorEnabled ?? true}
        />
      </main>
    </div>
  );
}
