"use client";

import AdminShell from "@/components/AdminShell";
import AuthGuard from "@/components/AuthGuard";
import DevicesView from "@/components/devices/DevicesView";

type PageProps = {
  params: {
    resellerId: string;
  };
};

export default function ResellerDevicesPage({ params }: PageProps) {
  const { resellerId } = params;

  return (
    <AuthGuard>
      <AdminShell>
        <div className="w-full h-[calc(100vh-56px)] flex flex-col">
          <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
            <div>
              <h1 className="text-sm md:text-base font-semibold">
                Appareils du revendeur #{resellerId}
              </h1>
              <p className="text-xs text-gray-500">
                Vue temps réel des devices gérés par ce revendeur.
              </p>
            </div>
          </div>

          <div className="flex-1">
            {/* 🔥 DevicesView sait déjà filtrer par resellerId si besoin */}
            <DevicesView resellerId={resellerId} />
          </div>
        </div>
      </AdminShell>
    </AuthGuard>
  );
}
