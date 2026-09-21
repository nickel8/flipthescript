import { getCloudSession, type CloudUser } from "./cloud-session";
import { redirect } from "next/navigation";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(user: CloudUser): boolean {
  return ADMIN_EMAILS.includes(user.email.toLowerCase());
}

export async function requireAdminSession(): Promise<CloudUser> {
  const session = await getCloudSession();
  if (!session) redirect("/cloud/sign-in");
  if (!isAdmin(session)) redirect("/cloud/dashboard");
  return session;
}
