import { adminOptions, adminProxy } from "../../_lib/gcAdminProxy";
export const runtime = "edge";

export const GET = (req: Request) => adminProxy(req, "/admin/tokens");
export const POST = (req: Request) => adminProxy(req, "/admin/tokens");
export const PUT = (req: Request) => adminProxy(req, "/admin/tokens");
export const PATCH = (req: Request) => adminProxy(req, "/admin/tokens");
export const DELETE = (req: Request) => adminProxy(req, "/admin/tokens");
export const HEAD = (req: Request) => adminProxy(req, "/admin/tokens");
export const OPTIONS = adminOptions;