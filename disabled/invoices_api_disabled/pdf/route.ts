import { NextRequest } from "next/server";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

type BillingInfo = {
  period: string;
  devicesCount: number;
  role: string;
  unitXof: number;
  totalXof: number;
  approxUsd: number;
};

type Invoice = {
  invoiceId: string;
  clientId: string;
  clientName: string | null;
  billing: BillingInfo;
  phone?: string | null;
  checkoutUrl: string;
  status: string;
  createdAt: string;
  paidAt?: string;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  // ✅ Next 16 : params est un Promise
  const { invoiceId } = await context.params;

  if (!invoiceId) {
    return new Response("Invoice ID manquant", { status: 400 });
  }

  // 1) Récupérer la facture depuis l’API GuardCloud
  const res = await fetch(`${API_BASE}/billing/invoice/${invoiceId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return new Response("Facture introuvable", { status: 404 });
  }

  const data = (await res.json()) as {
    ok: boolean;
    invoice?: Invoice;
    error?: string;
  };

  if (!data.ok || !data.invoice) {
    return new Response(data.error || "Facture introuvable", { status: 404 });
  }

  const invoice = data.invoice;
  const b = invoice.billing;

  // 2) Génération du PDF avec PDFKit (buffer en mémoire)
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => {
    chunks.push(chunk as Buffer);
  });

  const pdfPromise: Promise<Buffer> = new Promise((resolve, reject) => {
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", (err) => reject(err));
  });

  // --- En-tête Yarmotek ---
  doc
    .fontSize(18)
    .text("YARMOTEK INTERNATIONAL SARL", { align: "left" })
    .moveDown(0.3);

  doc
    .fontSize(10)
    .text("Yarmotek GuardCloud – Suivi & Sécurité PC / Smartphones", {
      align: "left",
    })
    .moveDown(0.2);

  doc
    .fontSize(9)
    .text("09 BP 634 Ouagadougou 09, Burkina Faso", { align: "left" })
    .text("Extension-Sud Ouaga 2000, Gargain, Section 972 Lot 273 Parcelle 8", {
      align: "left",
    })
    .text("Email : contact@yarmotek.com | WhatsApp : +226 75 25 54 16", {
      align: "left",
    })
    .moveDown(1);

  // Ligne de séparation
  doc
    .moveTo(50, doc.y)
    .lineTo(550, doc.y)
    .stroke()
    .moveDown(1);

  // --- Titre facture ---
  doc.fontSize(16).text("REÇU DE PAIEMENT GUARDCLOUD", {
    align: "center",
  });

  doc.moveDown(0.5);
  doc.fontSize(10).text(`Facture N° : ${invoice.invoiceId}`, {
    align: "center",
  });
  doc
    .fontSize(10)
    .text(
      `Date de création : ${new Date(
        invoice.createdAt
      ).toLocaleDateString("fr-FR")}`,
      { align: "center" }
    );
  if (invoice.paidAt) {
    doc
      .fontSize(10)
      .text(
        `Date de paiement : ${new Date(
          invoice.paidAt
        ).toLocaleDateString("fr-FR")}`,
        { align: "center" }
      );
  }

  doc.moveDown(1.5);

  // --- Infos client ---
  doc.fontSize(12).text("Informations client", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Client : ${invoice.clientName ?? invoice.clientId}`);
  doc.text(`ID client : ${invoice.clientId}`);
  if (invoice.phone) {
    doc.text(`Téléphone : ${invoice.phone}`);
  }
  doc.moveDown(1);

  // --- Détail abonnement ---
  doc.fontSize(12).text("Détail de l'abonnement GuardCloud", {
    underline: true,
  });
  doc.moveDown(0.5);
  doc.fontSize(10);

  const periodLabel =
    b.period === "YEARLY"
      ? "Annuel"
      : b.period === "WEEKLY"
      ? "Hebdomadaire"
      : "Mensuel";

  doc.text(`Période : ${periodLabel}`);
  doc.text(`Nombre d'appareils : ${b.devicesCount}`);
  doc.text(`Rôle : ${b.role === "RESELLER" ? "Revendeur" : "Client final"}`);
  doc.text(
    `Tarif unitaire : ${b.unitXof.toLocaleString(
      "fr-FR"
    )} XOF / période / appareil`
  );
  doc.moveDown(0.5);

  doc
    .fontSize(11)
    .text(
      `Montant total : ${b.totalXof.toLocaleString(
        "fr-FR"
      )} XOF (≈ ${b.approxUsd.toFixed(2)} USD)`,
      { align: "left" }
    );

  doc.moveDown(1.5);

  // --- Statut ---
  const paid =
    (invoice.status || "").toUpperCase() === "PAID" ? "PAYÉE" : "EN ATTENTE";

  doc
    .fontSize(12)
    .text("Statut du paiement", { underline: true })
    .moveDown(0.5);
  doc.fontSize(11).text(`Statut : ${paid}`);
  if (invoice.paidAt) {
    doc
      .fontSize(10)
      .text(
        `Confirmé le : ${new Date(
          invoice.paidAt
        ).toLocaleDateString("fr-FR")}`
      );
  }
  doc.moveDown(2);

  // --- Pied de page ---
  doc
    .fontSize(9)
    .text(
      "Ce reçu est généré automatiquement par la plateforme Yarmotek GuardCloud.",
      { align: "center" }
    );
  doc
    .fontSize(9)
    .text(
      "Pour toute question, contactez : billing@yarmotek.com / +226 75 25 54 16.",
      { align: "center" }
    );

  doc.end();

  const pdfBuffer = await pdfPromise;

  // ✅ Adapter le type pour Response : on envoie un Uint8Array
  const pdfUint8 = new Uint8Array(pdfBuffer);

  return new Response(pdfUint8, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="recu-${invoiceId}.pdf"`,
    },
  });
}
