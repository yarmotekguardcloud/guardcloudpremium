export const runtime = "edge";

export async function GET() {
  return Response.json({ ok: true, name: "GuardCloudPremium API proxy", time: new Date().toISOString() });
}
