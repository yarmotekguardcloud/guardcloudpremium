import React from "react";
import AuthGuard from "@/components/AuthGuard";
import DevicesView from "@/components/DevicesView";

interface PageProps {
  params: {
    clientId: string;
  };
}

// ✅ Requis pour `output: "export"` avec routes dynamiques
export function generateStaticParams() {
  return [];
}

const ClientDevicesPage: React.FC<PageProps> = ({ params }) => {
  const { clientId } = params;

  return (
    <AuthGuard>
      <main className="w-full h-[calc(100vh-56px)] bg-slate-950 text-white">
        {/* Pour plus tard : on pourra filtrer par clientId côté DevicesView */}
        <DevicesView /* initialClientFilter={clientId} */ />
      </main>
    </AuthGuard>
  );
};

export default ClientDevicesPage;
