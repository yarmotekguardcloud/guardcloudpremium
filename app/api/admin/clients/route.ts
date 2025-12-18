import { adminOptions, adminProxy } from "../../_lib/gcAdminProxy";
export const runtime = "edge";

export const GET = (req: Request) => adminProxy(req, "/admin/clients");
export const POST = (req: Request) => adminProxy(req, "/admin/clients");
export const PUT = (req: Request) => adminProxy(req, "/admin/clients");
export const PATCH = (req: Request) => adminProxy(req, "/admin/clients");
export const DELETE = (req: Request) => adminProxy(req, "/admin/clients");
export const HEAD = (req: Request) => adminProxy(req, "/admin/clients");
export const OPTIONS = adminOptions;