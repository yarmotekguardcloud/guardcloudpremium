"use client";

import Link from "next/link";
import Image from "next/image";

export default function TopNavbar() {
  return (
    <header className="sticky top-0 z-40 bg-black/90 backdrop-blur border-b border-white/5">
      <nav className="h-14 flex items-center justify-between px-4 md:px-8">
        {/* Logo + titre */}
        <div className="flex items-center gap-2">
          <Image
            src="/yarmotek-logo.png"
            alt="Yarmotek GuardCloud"
            width={28}
            height={28}
            className="rounded-md"
          />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm">
              Yarmotek GuardCloud
            </span>
            <span className="text-[10px] text-gray-400">
              Premium 2025 • Phones • PC • Drones • IoT
            </span>
          </div>
        </div>

        {/* Liens rapides */}
        <div className="flex items-center gap-3 text-[11px]">
          <Link
            href="/admin/devices"
            className="px-2 py-1 rounded-lg hover:bg-white/10 transition"
          >
            Admin
          </Link>
          <Link
            href="/client/devices"
            className="px-2 py-1 rounded-lg hover:bg-white/10 transition"
          >
            Client
          </Link>
          <Link
            href="/billing"
            className="px-2 py-1 rounded-lg hover:bg-white/10 transition"
          >
            Billing
          </Link>
        </div>
      </nav>
    </header>
  );
}
