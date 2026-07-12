// TotexCar Co-pilot — API de integração com o Totexmotors OS (autenticada por x-api-key)
// Ações: provision_owner, create_coupon, validate_coupon, list_coupons, get_owner
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

function daysUntil(dateStr: any): number | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const t = new Date(y, (m || 1) - 1, d || 1); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}
function vencimentosOf(vehicle: any, owner: any) {
  return [
    { tipo: "Licenciamento", date: vehicle?.licenciamento_vencimento },
    { tipo: "IPVA", date: vehicle?.ipva_vencimento },
    { tipo: "Seguro", date: vehicle?.seguro_vencimento },
    { tipo: "CNH", date: owner?.cnh_vencimento },
  ].filter((x) => x.date).map((x) => ({ ...x, days: daysUntil(x.date) }))
    .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const { data: s } = await admin.from("app_settings")
    .select("integration_api_key, app_url, plan_name").eq("id", 1).single();
  const apiKey = s?.integration_api_key || "";
  const provided = req.headers.get("x-api-key") || "";
  if (!apiKey || provided !== apiKey) return json({ error: "unauthorized" }, 401);

  let p: any = {};
  try { p = await req.json(); } catch { /* */ }
  const action = p.action as string;
  const appUrl = (s?.app_url || "").replace(/\/+$/, "");

  try {
    switch (action) {
      case "validate_coupon": {
        const code = String(p.code || "").trim();
        const { data: c } = await admin.from("coupons").select("*").ilike("code", code).limit(1);
        const cp = c?.[0];
        const valid = !!cp && cp.active && (cp.max_uses == null || Number(cp.used_count) < Number(cp.max_uses));
        return json({ ok: true, valid, discount_pct: cp?.discount_pct ?? null, dealership: cp?.dealership ?? null, label: cp?.label ?? null });
      }

      case "create_coupon": {
        const code = String(p.code || "").trim().toUpperCase();
        if (!code) return json({ error: "code_required" }, 400);
        const { data, error } = await admin.from("coupons").insert({
          code,
          label: p.label || null,
          dealership: p.dealership || null,
          discount_pct: p.discount_pct != null ? Number(p.discount_pct) : 90,
          max_uses: p.max_uses != null ? Number(p.max_uses) : null,
          active: p.active !== false,
        }).select().single();
        if (error) throw error;
        return json({ ok: true, coupon: data });
      }

      case "provision_owner": {
        const { name, email, phone, dealership, coupon_code } = p;
        if (!email) return json({ error: "email_required" }, 400);
        const emailNorm = String(email).trim().toLowerCase();
        const phoneNorm = phone ? onlyDigits(String(phone)) : null;

        const planPath = coupon_code ? `/plans?coupon=${encodeURIComponent(coupon_code)}` : "/plans";
        const planLink = appUrl ? `${appUrl}${planPath}` : planPath;

        // Idempotente por email: se já existe, reaproveita (sem gerar senha nova)
        const { data: exist } = await admin.from("users").select("id, email").ilike("email", emailNorm).limit(1);
        if (exist && exist.length) {
          await admin.from("users").update({
            name: name || "Proprietário", phone: phoneNorm,
            dealership: dealership || null, coupon_code: coupon_code || null,
          }).eq("id", exist[0].id);
          return json({ ok: true, already_existed: true, user_id: exist[0].id, email: emailNorm, password: null, login_url: appUrl || null, plan_link: planLink, plan_name: s?.plan_name || "Totex Care" });
        }

        const password = String(p.password || crypto.randomUUID().slice(0, 10));
        const { data: created, error } = await admin.auth.admin.createUser({
          email: emailNorm, password, email_confirm: true,
          user_metadata: { name: name || "Proprietário", phone: phoneNorm, email: emailNorm },
        });
        if (error) throw error;
        const id = created.user!.id;
        await admin.from("users").update({
          name: name || "Proprietário", phone: phoneNorm, email: emailNorm, role: "owner",
          dealership: dealership || null, coupon_code: coupon_code || null,
        }).eq("id", id);

        return json({ ok: true, already_existed: false, user_id: id, email: emailNorm, password, login_url: appUrl || null, plan_link: planLink, plan_name: s?.plan_name || "Totex Care" });
      }

      case "get_owner": {
        const { email, phone } = p;
        let q = admin.from("users").select("id, name, email, phone, plan, subscription_status, dealership, coupon_code, referral_code, pix_key");
        if (email) q = q.eq("email", email);
        else if (phone) q = q.ilike("phone", `%${onlyDigits(String(phone)).slice(-11)}`);
        else return json({ error: "email_or_phone_required" }, 400);
        const { data } = await q.limit(1);
        return json({ ok: true, owner: data?.[0] || null });
      }

      case "list_coupons": {
        const { data } = await admin.from("coupons").select("*").order("created_at", { ascending: false });
        return json({ ok: true, coupons: data });
      }

      // Painel do Lojista: lista de clientes (opcionalmente filtrada por loja) com resumo da jornada
      case "list_owners": {
        const dealership = p.dealership ? String(p.dealership) : null;
        let q = admin.from("users")
          .select("id, name, email, phone, plan, subscription_status, coupon_code, dealership, cnh_vencimento, created_at, plan_cycle, plan_value")
          .eq("role", "owner")
          .order("created_at", { ascending: false });
        if (dealership) q = q.eq("dealership", dealership);
        const { data: owners } = await q.limit(Number(p.limit) || 300);
        const ids = (owners || []).map((o: any) => o.id);
        if (!ids.length) return json({ ok: true, owners: [], dealership });

        const { data: vehicles } = await admin.from("accounts")
          .select("user_id, name, marca, modelo, placa, hodometro, licenciamento_vencimento, ipva_vencimento, seguro_vencimento")
          .in("user_id", ids);
        const { data: txs } = await admin.from("transactions")
          .select("user_id, amount, type, transaction_date").in("user_id", ids);

        const vByUser: Record<string, any> = {};
        (vehicles || []).forEach((v: any) => { if (!vByUser[v.user_id]) vByUser[v.user_id] = v; });
        const agg: Record<string, any> = {};
        (txs || []).forEach((t: any) => {
          const a = agg[t.user_id] || (agg[t.user_id] = { total: 0, count: 0, last: null });
          if (t.type === "expense") { a.total += Math.abs(t.amount); a.count++; }
          if (!a.last || t.transaction_date > a.last) a.last = t.transaction_date;
        });

        const result = (owners || []).map((o: any) => {
          const v = vByUser[o.id] || null;
          const ven = vencimentosOf(v, o);
          const a = agg[o.id] || { total: 0, count: 0, last: null };
          return {
            id: o.id, name: o.name, email: o.email, phone: o.phone,
            plan: o.plan, subscription_status: o.subscription_status,
            coupon_code: o.coupon_code, dealership: o.dealership, created_at: o.created_at,
            vehicle: v ? { apelido: v.name, marca: v.marca, modelo: v.modelo, placa: v.placa, hodometro: v.hodometro } : null,
            next_due: ven[0] || null,
            total_expenses: Number(a.total.toFixed(2)), expense_count: a.count, last_expense_date: a.last,
          };
        });
        return json({ ok: true, dealership, owners: result });
      }

      // Painel do Lojista: jornada detalhada de um cliente
      case "owner_journey": {
        const { user_id, email } = p;
        let oq = admin.from("users").select("*");
        if (user_id) oq = oq.eq("id", user_id);
        else if (email) oq = oq.ilike("email", String(email).trim().toLowerCase());
        else return json({ error: "user_id_or_email_required" }, 400);
        const { data: ow } = await oq.limit(1);
        const owner = ow?.[0];
        if (!owner) return json({ ok: true, owner: null });

        const { data: vs } = await admin.from("accounts").select("*").eq("user_id", owner.id).limit(1);
        const vehicle = vs?.[0] || null;
        const { data: tx } = await admin.from("transactions")
          .select("description, amount, type, transaction_date, odometer, categories(name)")
          .eq("user_id", owner.id).order("transaction_date", { ascending: false }).limit(20);

        let total = 0, count = 0; const byCat: Record<string, number> = {};
        (tx || []).forEach((t: any) => {
          if (t.type === "expense") { total += Math.abs(t.amount); count++; const n = t.categories?.name || "Outros"; byCat[n] = (byCat[n] || 0) + Math.abs(t.amount); }
        });

        return json({
          ok: true,
          owner: { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone, plan: owner.plan, subscription_status: owner.subscription_status, dealership: owner.dealership, coupon_code: owner.coupon_code, created_at: owner.created_at },
          vehicle,
          vencimentos: vencimentosOf(vehicle, owner),
          expenses: { total: Number(total.toFixed(2)), count, by_category: byCat },
          recent_expenses: (tx || []).map((t: any) => ({ description: t.description, amount: t.amount, type: t.type, date: t.transaction_date, odometer: t.odometer, category: t.categories?.name })),
        });
      }

      // ===== Fase 3 — Indicação =====
      // OS empurra o estoque pro TCF (upsert por external_id)
      case "sync_inventory": {
        const cars = Array.isArray(p.cars) ? p.cars : [];
        if (!cars.length) return json({ error: "cars_required" }, 400);
        const rows = cars.map((c: any) => ({
          external_id: String(c.external_id ?? c.id ?? "").trim(),
          dealership: c.dealership ?? null,
          store_whatsapp: c.store_whatsapp ? onlyDigits(String(c.store_whatsapp)) : null,
          title: c.title ?? ([c.brand, c.model, c.year].filter(Boolean).join(" ") || null),
          brand: c.brand ?? null,
          model: c.model ?? null,
          year: c.year != null ? Number(c.year) : null,
          price: c.price != null ? Number(c.price) : null,
          km: c.km != null ? Number(c.km) : null,
          color: c.color ?? null,
          photo_url: c.photo_url ?? c.photo ?? null,
          url: c.url ?? null,
          active: c.active !== false,
          synced_at: new Date().toISOString(),
        })).filter((r: any) => r.external_id);
        if (!rows.length) return json({ error: "no_valid_cars" }, 400);
        const { error } = await admin.from("inventory").upsert(rows, { onConflict: "external_id" });
        if (error) throw error;
        return json({ ok: true, upserted: rows.length });
      }

      // OS reporta evento (venda confirmada) para um código de dono; ou marca um evento como pago
      case "report_referral": {
        // marcar pago um evento existente
        if (p.event_id) {
          const status = p.status || "paid";
          const updates: any = { status };
          if (status === "paid") updates.paid_at = new Date().toISOString();
          const { data, error } = await admin.from("referral_events").update(updates).eq("id", p.event_id).select().single();
          if (error) throw error;
          return json({ ok: true, event: data });
        }
        // resolver dono por id ou código (retorna a chave PIX p/ o OS pagar)
        const sel = "id, name, dealership, referral_code, pix_key";
        let ownerRow: any = null;
        if (p.owner_id) {
          const { data } = await admin.from("users").select(sel).eq("id", p.owner_id).limit(1);
          ownerRow = data?.[0] || null;
        } else if (p.owner_code) {
          const { data } = await admin.from("users").select(sel).ilike("referral_code", String(p.owner_code)).limit(1);
          ownerRow = data?.[0] || null;
        }
        if (!ownerRow) return json({ error: "owner_not_found" }, 404);
        const dealership = p.dealership || ownerRow.dealership || null;
        const type = ["click", "lead", "sale"].includes(String(p.type)) ? String(p.type) : "sale";
        const { data, error } = await admin.from("referral_events").insert({
          owner_id: ownerRow.id,
          referral_code: ownerRow.referral_code,
          dealership,
          car_external_id: p.car_external_id || null,
          car_title: p.car_title || null,
          type,
          value: p.value != null ? Number(p.value) : 0,
          status: p.status || (type === "sale" ? "pending" : "logged"),
        }).select().single();
        if (error) throw error;
        return json({ ok: true, event: data, owner: { id: ownerRow.id, name: ownerRow.name, referral_code: ownerRow.referral_code, pix_key: ownerRow.pix_key } });
      }

      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 400);
  }
});
