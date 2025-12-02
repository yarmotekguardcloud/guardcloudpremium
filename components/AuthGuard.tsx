"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { getAdminToken } from "@/lib/auth";

type Props = {
  children: ReactNode;
};

export default function AuthGuard({ children }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ok" | "redirecting">(
    "checking"
  );

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setStatus("redirecting");
      router.replace("/admin/login");
    } else {
      setStatus("ok");
    }
  }, [router]);

  if (status === "checking") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500">
        Vérification de la session administrateur...
      </div>
    );
  }

  if (status === "redirecting") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500">
        Redirection vers la page de connexion...
      </div>
    );
  }

  return <>{children}</>;
}
