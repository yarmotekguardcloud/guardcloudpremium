import { Suspense } from "react";
import ActivateClient from "./ActivateClient";

export const dynamic = "force-dynamic"; // évite les surprises de prerender
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-slate-200">
          Chargement…
        </div>
      }
    >
      <ActivateClient />
    </Suspense>
  );
}
