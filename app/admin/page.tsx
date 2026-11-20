import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserBalance } from "@/lib/ledger";
import AdminClient from "./AdminClient";
import Link from "next/link";

export const instant = false;

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, name: true },
  });

  if (currentUser?.role !== "ADMIN") redirect("/dashboard");

  const allUsers = await prisma.user.findMany({
    orderBy: { accountNo: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accountNo: true,
      isSuspended: true,
      idType: true,
      idNumber: true,
      idDocumentUrl: true,
      kycStatus: true,
      accountOfficerName: true,
      accountOfficerEmail: true,
      accountTier: true,
      passText: true,
    },
  });

  const usersWithBalances = await Promise.all(
    allUsers.map(async (u) => ({
      ...u,
      balance: await getUserBalance(u.id),
    }))
  );

  const allTransactions = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      sender: { select: { name: true, email: true, accountNo: true } },
      receiver: { select: { name: true, email: true, accountNo: true } },
    },
  });

  const allLoans = await prisma.loan.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true, accountNo: true } } },
  });

  const settings = await prisma.systemSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] antialiased text-slate-900 font-sans">
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-lg">
              A
            </div>
            <div>
              <span className="text-base font-bold tracking-tight">{settings.vaultName} Admin</span>
              <span className="text-[10px] block font-mono text-indigo-400 uppercase tracking-wider -mt-0.5">
                Compliance & Treasury Desk
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/dashboard"
              className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl transition"
            >
              ← User Vault
            </Link>
            <a
              href="/api/auth/signout"
              className="text-xs font-bold bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-3.5 py-2 rounded-xl transition"
            >
              Sign Out
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminClient
          users={usersWithBalances}
          transactions={allTransactions}
          loans={allLoans}
          settings={settings}
        />
      </main>
    </div>
  );
}
