// app/admin/page.tsx
import AntiTheftDashboard from "./devices/AntiTheftDashboard";

export default function AdminGlobalPage() {
  return <AntiTheftDashboard initialRole="SUPER_ADMIN" />;
}
