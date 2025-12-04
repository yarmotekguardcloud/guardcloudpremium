import { redirect } from "next/navigation";

// ⚠️ Cette page ne doit PLUS contenir de Leaflet / "use client"
// Elle sert juste à rediriger vers la vraie carte admin.

export default function MapDevicesLegacyRedirectPage() {
  // Redirection serveur côté Next
  redirect("/admin/devices");
}
