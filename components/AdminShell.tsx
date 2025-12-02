"use client";

import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearAdminToken } from "@/lib/auth";

type Props = {
  children: ReactNode;
};

export default function AdminShell({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function isActive(path: string) {
    return pathname.startsWith(path);
  }

  function handleLogout() {
    clearAdminToken();
    router.replace("/admin/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Topbar */}
      <header className="h-14 flex items-center justify-between px-4 md:px-8 border-b bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
            YG
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">
              Yarmotek GuardCloud
            </span>
            <span className="text-[10px] text-gray-500">
              Console d&apos;administration
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-2 md:gap-4 text-xs md:text-sm">
          <NavLink
            href="/admin/devices"
            active={isActive("/admin/devices")}
          >
            Admin global
          </NavLink>
          <NavLink
            href="/admin/clients"
            active={isActive("/admin/clients")}
          >
            Clients
          </NavLink>
          <NavLink
            href="/admin/resellers"
            active={isActive("/admin/resellers")}
          >
            Revendeurs
          </NavLink>

          <button
            type="button"
            onClick={handleLogout}
            className="ml-2 rounded-full border border-red-500 text-red-600 px-3 py-1 text-xs font-medium hover:bg-red-50"
          >
            Se déconnecter
          </button>
        </nav>
      </header>

      {/* Contenu */}
      <main className="flex-1">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={`px-3 py-1.5 rounded-full border text-xs md:text-sm transition ${
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}
