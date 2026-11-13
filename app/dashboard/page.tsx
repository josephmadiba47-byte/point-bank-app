import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserBalance } from "@/lib/ledger";
import DashboardClient from "./DashboardClient";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export const instant = false;
const ITEMS_PER_PAGE = 5;

interface Props {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$';
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id!;
  const userName = session.user.name!;
  const currentBalance = await getUserBalance(userId);

  // Fetch the user's 8-digit numeric routing account number
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountNo: true, name: true, email: true, role: true },
  });
 
  // Check if the user currently has an unverified outgoing transfer
  const pendingTransfer = await prisma.transaction.findFirst({
    where: { senderId: userId, authCode: { not: null } },
  });

  const beneficiaries = await prisma.beneficiary.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const resolvedParams = await searchParams;
  const currentPage = Math.max(1, parseInt(resolvedParams.page || "1", 10));
  const searchQuery = resolvedParams.search || "";

  // Show completed transactions (sent or received) PLUS the user's own pending outgoing transfers
  const userLedgerFilter: any = {
    OR: [
      { senderId: userId },
      { receiverId: userId, authCode: null },
    ],
  };

  if (searchQuery) {
    const searchAsNumber = parseInt(searchQuery, 10);
    userLedgerFilter.AND = [
      {
        OR: [
          { description: { contains: searchQuery, mode: "insensitive" } },
          { recipientName: { contains: searchQuery, mode: "insensitive" } },
          { recipientAccountNo: { contains: searchQuery, mode: "insensitive" } },
          { recipientSystemName: { contains: searchQuery, mode: "insensitive" } },
          { routingNumber: { contains: searchQuery, mode: "insensitive" } },
          ...(!isNaN(searchAsNumber) ? [{ sender: { accountNo: searchAsNumber } }] : []),
        ],
      },
    ];
  }


  const totalTransactions = await prisma.transaction.count({
    where: userLedgerFilter,
  });
  const totalPages = Math.ceil(totalTransactions / ITEMS_PER_PAGE) || 1;

  const transactions = await prisma.transaction.findMany({
    where: userLedgerFilter,
    orderBy: { createdAt: "desc" },
    take: ITEMS_PER_PAGE,
    skip: (currentPage - 1) * ITEMS_PER_PAGE,
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
              P
            </div>
            <div>
              <span className="text-base font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                PointVault
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardClient
          userId={userId}
          userName={userName}
          currentBalance={currentBalance}
          currentAccountNo={dbUser?.accountNo || "Pending"}
          transactions={transactions}
          beneficiaries={beneficiaries}
          hasPending={!!pendingTransfer}
          currentPage={currentPage}
          totalPages={totalPages}
          totalTransactions={totalTransactions}
          searchQuery={searchQuery}
        />
      </main>
    </div>
  );
}
