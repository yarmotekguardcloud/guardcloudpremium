"use client";

import { useEffect } from "react";

export default function ClientsPageClient() {
  useEffect(() => {
    // ✅ tout ce qui touche window/localStorage/document ici
    // if (typeof window !== "undefined") { ... }
  }, []);

  return <div>...</div>;
}
