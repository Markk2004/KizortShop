import type { ReactNode } from "react";
import { AdminHeader } from "@/features/admin/components/AdminHeader";
import { AdminSidebar } from "@/features/admin/components/AdminSidebar";

export const metadata = {
  title: "KaiZort — Admin Management Portal",
  description: "ระบบจัดการร้านค้าสำหรับผู้ดูแลระบบ KaiZort",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#09090b] text-zinc-100 font-sans antialiased">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />
        <main className="flex-1 p-6 md:p-8 max-w-[1520px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
