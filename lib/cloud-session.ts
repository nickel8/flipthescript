import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const COOKIE_NAME = "fts_cloud_token";

export interface CloudUser {
  id: string;
  email: string;
  token: string;
}

export async function getCloudSession(): Promise<CloudUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const user = await res.json();
  if (!user?.id) return null;

  return { id: user.id, email: user.email, token };
}

export async function requireCloudSession(): Promise<CloudUser> {
  const session = await getCloudSession();
  if (!session) redirect("/cloud/sign-in");
  return session;
}

export const CLOUD_COOKIE = COOKIE_NAME;
