// TotexCar Co-pilot — Admin API (gestão de proprietários)
// Ações protegidas por papel admin. Usa service role para criar/excluir contas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // identifica o chamador pelo JWT
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);
  const caller = userData.user;

  let payload: any = {};
  try { payload = await req.json(); } catch { /* */ }
  const action = payload.action as string;

  // papel atual do chamador
  const { data: me } = await admin.from("users").select("role").eq("id", caller.id).single();
  const isAdmin = me?.role === "admin";

  // bootstrap: 1º admin (só se ainda não existe nenhum admin)
  if (action === "bootstrap_admin") {
    const { count } = await admin.from("users").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count || 0) > 0) return json({ error: "admin_already_exists" }, 403);
    const { error } = await admin.from("users").update({ role: "admin" }).eq("id", caller.id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, role: "admin" });
  }

  if (!isAdmin) return json({ error: "forbidden" }, 403);

  try {
    switch (action) {
      case "list_owners": {
        const { data, error } = await admin
          .from("users")
          .select("id, name, phone, email, role, created_at")
          .neq("role", "dealer")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ ok: true, owners: data });
      }

      case "create_owner": {
        const { email, password, name, phone, role, dealership } = payload;
        if (!email || !password) return json({ error: "email_password_required" }, 400);
        const phoneNorm = phone ? String(phone).replace(/\D/g, "") : null;
        const normRole = role === "admin" ? "admin" : role === "dealer" ? "dealer" : "owner";
        const defaultName = normRole === "dealer" ? "Lojista" : "Proprietário";
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: name || defaultName, phone: phoneNorm, email },
        });
        if (error) throw error;
        const newId = data.user!.id;
        // garante perfil atualizado (o trigger já cria a linha)
        await admin.from("users").update({
          name: name || defaultName,
          phone: phoneNorm,
          email,
          role: normRole,
          dealership: dealership || null,
        }).eq("id", newId);
        return json({ ok: true, id: newId });
      }

      case "update_owner": {
        const { id, name, phone, role, dealership } = payload;
        if (!id) return json({ error: "id_required" }, 400);
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (phone !== undefined) updates.phone = phone ? String(phone).replace(/\D/g, "") : null;
        if (role !== undefined) updates.role = role === "admin" ? "admin" : role === "dealer" ? "dealer" : "owner";
        if (dealership !== undefined) updates.dealership = dealership || null;
        const { error } = await admin.from("users").update(updates).eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }

      case "list_dealers": {
        const { data, error } = await admin
          .from("users")
          .select("id, name, phone, email, role, dealership, created_at")
          .eq("role", "dealer")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ ok: true, dealers: data });
      }

      case "delete_owner": {
        const { id } = payload;
        if (!id) return json({ error: "id_required" }, 400);
        if (id === caller.id) return json({ error: "cannot_delete_self" }, 400);
        await admin.from("users").delete().eq("id", id);
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw error;
        return json({ ok: true });
      }

      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 400);
  }
});
