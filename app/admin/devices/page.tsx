// app/admin/devices/page.tsx
'use client';

import dynamic from 'next/dynamic';
import { AdminShell } from '@/components/AdminShell';
import AuthGuard from '@/components/AuthGuard';

// ⚡ On charge le Dashboard Antivol GuardCloud côté client uniquement
const AntiTheftDashboard = dynamic(
  () => import('./AntiTheftDashboard'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[calc(100vh-140px)] flex items-center justify-center bg-slate-900 text-white">
        Chargement du Dashboard Antivol GuardCloud...
      </div>
    ),
  }
);

export default function DevicesPage() {
  return (
    <AuthGuard>
      <AdminShell>
        <AntiTheftDashboard />
      </AdminShell>
    </AuthGuard>
  );
}
