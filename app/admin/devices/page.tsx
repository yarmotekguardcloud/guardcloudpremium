'use client';

import dynamic from 'next/dynamic';

const DevicesMapClient = dynamic(() => import('./DevicesMapClient'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-slate-950 text-white">
      Chargement GuardCloud…
    </div>
  ),
});

export default function DevicesPage() {
  return <DevicesMapClient />;
}
