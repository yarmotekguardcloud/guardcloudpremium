import React from "react";
import AuthGuard from "@/components/AuthGuard";
import DevicesView from "@/components/DevicesView";

interface PageProps {
  params: {
    resellerId: string;
  };
}

export function generateStaticParams() {
  return [];
}

const ResellerDevicesPage: React.FC<PageProps> = ({ params }) => {
  const { resellerId } = params;

  return (
    <AuthGuard>
      <main className="w-full h-[calc(100vh-56px)] bg-slate-950 text-white">
        {/* Pour plus tard : filtre par revendeur possible ici */}
        <DevicesView /* initialResellerFilter={resellerId} */ />
      </main>
    </AuthGuard>
  );
};

export default ResellerDevicesPage;
