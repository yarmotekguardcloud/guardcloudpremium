import AuthGuard from "@/components/AuthGuard";
import AdminShell from "@/components/AdminShell";
import AntiTheftDashboard from "./AntiTheftDashboard";

export default function DevicesPage() {
  return (
    <AuthGuard>
      <AdminShell>
        <AntiTheftDashboard />
      </AdminShell>
    </AuthGuard>
  );
}
