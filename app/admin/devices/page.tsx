// app/admin/devices/page.tsx
"use client";

import dynamic from "next/dynamic";
import { AdminShell } from "@/components/AdminShell";
import AuthGuard from "@/components/AuthGuard";

const DevicesMapClient = dynamic(() => import("./DevicesMapClient"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-140px)] flex items-center justify-center bg-slate-900 text-white">
      Chargement de la carte GuardCloud...
    </div>
  ),
});

export default function DevicesPage() {
  return (
    <AuthGuard>
      <AdminShell>
        <DevicesMapClient />
      </AdminShell>
    </AuthGuard>
  );
}
