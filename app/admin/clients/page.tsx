// app/admin/clients/page.tsx
import { AdminShell } from "@/components/AdminShell";
import AuthGuard from "@/components/AuthGuard";
import ClientsListClient from "./ClientsListClient";

export default function ClientsPage() {
  return (
    <AuthGuard>
      <AdminShell>
        <ClientsListClient />
      </AdminShell>
    </AuthGuard>
  );
}
