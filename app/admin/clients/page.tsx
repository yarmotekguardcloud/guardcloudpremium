// app/admin/clients/page.tsx
import ClientsListClient from "./ClientsListClient";

export const runtime = "edge";          // optionnel
export const dynamic = "force-dynamic"; // ✅ évite le prerender au build
export const revalidate = 0;            // ✅ pas de cache SSG

export default function ClientsPage() {
  // ✅ Server Component: zéro window ici
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <ClientsListClient />
    </div>
  );
}
