import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";   // ✅ SEUL endroit où on importe cette CSS
import TopNavbar from "@/components/TopNavbar";

export const metadata: Metadata = {
  title: "Yarmotek GuardCloud – Premium 2025",
  description:
    "Yarmotek GuardCloud – Universal Tracking • Phones • PC • Drones • GPS • IoT.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-slate-950 text-white">
        <TopNavbar />
        {children}
      </body>
    </html>
  );
}
