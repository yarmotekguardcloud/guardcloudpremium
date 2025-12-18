import { adminOptions, adminProxy } from "../../_lib/gcAdminProxy";
export const runtime = "edge";

export const GET = (req: Request) => adminProxy(req, "/admin/resellers");
export const POST = (req: Request) => adminProxy(req, "/admin/resellers");
export const PUT = (req: Request) => adminProxy(req, "/admin/resellers");
export const PATCH = (req: Request) => adminProxy(req, "/admin/resellers");
export const DELETE = (req: Request) => adminProxy(req, "/admin/resellers");
export const HEAD = (req: Request) => adminProxy(req, "/admin/resellers");
export const OPTIONS = adminOptions;