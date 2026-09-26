import { requireCloudSession } from "@/lib/cloud-session";
import { notFound } from "next/navigation";
import ProductionShell from "./ProductionShell";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function ProductionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ cloudId: string }>;
}) {
  const { cloudId } = await params;
  const session = await requireCloudSession();

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/productions?cloud_id=eq.${cloudId}&select=id,name,owner_id`,
    {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      cache: "no-store",
    }
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) notFound();
  const prod = rows[0] as { id: string; name: string; owner_id: string };

  // Verify access and determine canEdit
  let canEdit = prod.owner_id === session.id;
  if (!canEdit) {
    const memRes = await fetch(
      `${SUPABASE_URL}/rest/v1/production_members?production_id=eq.${prod.id}&user_id=eq.${session.id}&select=role`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: "no-store" }
    );
    const mems = await memRes.json();
    if (!Array.isArray(mems) || mems.length === 0) notFound();
    const role = mems[0].role as string;
    canEdit = role === "collaborator" || role === "dept_owner";
  }

  return (
    <ProductionShell cloudId={cloudId} userId={session.id} productionName={prod.name} canEdit={canEdit}>
      {children}
    </ProductionShell>
  );
}
