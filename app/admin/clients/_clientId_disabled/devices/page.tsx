"use client";

import AdminShell from "@/components/AdminShell";
import AuthGuard from "@/components/AuthGuard";
import DevicesView from "@/components/devices/DevicesView";

type PageProps = {
  params: {
    clientId: string;
  };
};

export default function ClientDevicesPage({ params }: PageProps) {
  const { clientId } = params;

  return (
    <AuthGuard>
      <AdminShell>
        <div className="w-full h-[calc(100vh-56px)] flex flex-col">
          <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
            <div>
              <h1 className="text-sm md:text-base font-semibold">
                Appareils du client #{clientId}
              </h1>
              <p className="text-xs text-gray-500">
                Vue temps réel des téléphones, PC et autres devices
                liés à ce client.
              </p>
            </div>
          </div>

          <div className="flex-1">
            {/* 🔥 DevicesView sait déjà interroger l'API et afficher la carte + liste */}
            <DevicesView clientId={clientId} />
          </div>
        </div>
      </AdminShell>
    </AuthGuard>
  );
}
