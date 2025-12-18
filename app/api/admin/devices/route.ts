import { adminOptions, adminProxy } from "../../_lib/gcAdminProxy";
export const runtime = "edge";

export const GET = (req: Request) => adminProxy(req, "/admin/devices");
export const POST = (req: Request) => adminProxy(req, "/admin/devices");
export const PUT = (req: Request) => adminProxy(req, "/admin/devices");
export const PATCH = (req: Request) => adminProxy(req, "/admin/devices");
export const DELETE = (req: Request) => adminProxy(req, "/admin/devices");
export const HEAD = (req: Request) => adminProxy(req, "/admin/devices");
export const OPTIONS = adminOptions;