// app/(app)/layout.tsx
import { Sidebar } from "/components/sidebar";        // create this
import { Header } from components/header";          // create this
import { redirect } from "next/navigation";
// import { getCurrentUser } from "@/lib/auth";        // your auth logic

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // const user = await getCurrentUser();
  // if (!user) redirect("/login");

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}