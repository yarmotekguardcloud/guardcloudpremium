"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { jwtDecode } from "jwt-decode";

const TopNavbar = () => {
  const [jwt, setJwt] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("YGC_JWT");
    if (!stored) return;
    setJwt(stored);

    try {
      const decoded: any = jwtDecode(stored);
      setRole(decoded.role || null);
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="w-full bg-slate-950 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      {/* LEFT : Logo + Branding */}
      <div className="flex items-center gap-3">

        {/* Logo rond Yarmotek */}
        <div className="w-11 h-11 rounded-full overflow-hidden border border-slate-700 bg-slate-900 flex items-center justify-center">
          <Image
            src="/logo-yarmotek.png"
            alt="Yarmotek Logo"
            width={44}
            height={44}
            className="object-cover"
          />
        </div>

        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-base text-slate-200 tracking-tight">
            YARMOTEK <span className="text-amber-400">GUARDCLOUD</span>
          </span>

          <span className="text-[11px] text-slate-400">
            UNIVERSAL TRACKING • PHONES • PC • DRONES • GPS • IOT
          </span>
        </div>
      </div>

      {/* RIGHT : Boutons */}
      <div className="flex items-center gap-3">
        <select className="bg-slate-900 text-slate-200 border border-slate-700 text-xs px-2 py-1 rounded">
          <option value="FR">FR</option>
          <option value="EN">EN</option>
        </select>

        <button className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs px-4 py-1.5 rounded font-semibold">
          Coller un JWT
        </button>
      </div>
    </div>
  );
};

export default TopNavbar;
