// TotexCar Co-pilot — Rastreador (SmartGPS Legacy API)
// Conta-mestre: 1 login SmartGPS (creds em app_settings), cada carro = um device.
// Autentica 1x, cacheia o user_api_hash e mapeia cada usuário ao device pela placa/IMEI.
// Ações (JWT do app): live, history, link_status | admin: list_devices, assign
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const HASH_TTL_MS = 1000 * 60 * 60 * 12; // 12h
const norm = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// achata um objeto em chave(min, sem separadores)->valor, p/ leitura tolerante de campos variáveis
function flatten(obj: any, out: Record<string, any> = {}): Record<string, any> {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") flatten(v, out);
    else {
      const key = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (out[key] == null && v != null && v !== "") out[key] = v;
    }
  }
  return out;
}
function pickNum(flat: Record<string, any>, cands: string[]): number | null {
  for (const c of cands) {
    const v = flat[c];
    if (v != null) { const n = Number(String(v).replace(",", ".")); if (Number.isFinite(n)) return n; }
  }
  return null;
}

type Cfg = { base: string; email: string; password: string; hash: string | null; hashAt: string | null; enabled: boolean };

async function loadCfg(): Promise<Cfg> {
  const { data } = await admin.from("app_settings")
    .select("smartgps_base_url, smartgps_email, smartgps_password, smartgps_hash, smartgps_hash_at, smartgps_enabled")
    .eq("id", 1).single();
  return {
    base: (data?.smartgps_base_url || "https://web.smartgps.com.br").replace(/\/+$/, ""),
    email: data?.smartgps_email || "",
    password: data?.smartgps_password || "",
    hash: data?.smartgps_hash || null,
    hashAt: data?.smartgps_hash_at || null,
    enabled: !!data?.smartgps_enabled,
  };
}

async function login(cfg: Cfg): Promise<string> {
  const res = await fetch(`${cfg.base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: cfg.email, password: cfg.password }),
  });
  const data = await res.json().catch(() => ({}));
  const hash = data?.user_api_hash;
  if (!res.ok || !hash) throw new Error(data?.message || data?.error || `smartgps_login_falhou_${res.status}`);
  await admin.from("app_settings").update({ smartgps_hash: hash, smartgps_hash_at: new Date().toISOString() }).eq("id", 1);
  return hash;
}

async function getHash(cfg: Cfg): Promise<string> {
  const fresh = cfg.hash && cfg.hashAt && (Date.now() - new Date(cfg.hashAt).getTime() < HASH_TTL_MS);
  if (fresh) return cfg.hash!;
  return await login(cfg);
}

// GET autenticado com retry de login em caso de 401/sessão inválida
async function apiGet(cfg: Cfg, hashRef: { hash: string }, path: string, qs: Record<string, string> = {}) {
  const build = (h: string) => {
    const u = new URL(`${cfg.base}${path}`);
    u.searchParams.set("user_api_hash", h);
    for (const [k, v] of Object.entries(qs)) if (v != null) u.searchParams.set(k, v);
    return u.toString();
  };
  let res = await fetch(build(hashRef.hash), { headers: { Accept: "application/json" } });
  if (res.status === 401 || res.status === 419) {
    hashRef.hash = await login(cfg);
    res = await fetch(build(hashRef.hash), { headers: { Accept: "application/json" } });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `smartgps_${res.status}`);
  return data;
}

// devices da conta-mestre (lista crua, normalizada p/ array)
async function getDevices(cfg: Cfg, hashRef: { hash: string }): Promise<any[]> {
  const data = await apiGet(cfg, hashRef, "/api/get_devices");
  const items = data?.items ?? data?.data ?? data;
  if (Array.isArray(items)) return items;
  // alguns tenants devolvem grupos: [{ items: [...] }]
  if (Array.isArray(items?.[0]?.items)) return items.flatMap((g: any) => g.items || []);
  return [];
}

function matchDevice(devices: any[], deviceId: number | null, imei: string | null, placa: string | null) {
  if (deviceId != null) { const d = devices.find((x) => Number(x.id) === Number(deviceId)); if (d) return d; }
  if (imei) { const d = devices.find((x) => norm(x.imei) === norm(imei)); if (d) return d; }
  if (placa) {
    const p = norm(placa);
    const d = devices.find((x) => norm(x.name).includes(p) || norm(x.plate).includes(p) || norm(x.plate_number).includes(p));
    if (d) return d;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !ud?.user) return json({ error: "invalid_token" }, 401);
  const userId = ud.user.id;

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const action = String(body.action || "live");

  const cfg = await loadCfg();
  if (!cfg.enabled) return json({ error: "smartgps_desativado" }, 400);
  if (!cfg.email || !cfg.password) return json({ error: "smartgps_nao_configurado" }, 400);

  // perfil do usuário (role)
  const { data: me } = await admin.from("users").select("role").eq("id", userId).single();
  const isAdmin = me?.role === "admin";

  try {
    const hashRef = { hash: await getHash(cfg) };

    // ---- admin: listar todos os devices da conta-mestre (p/ vincular) ----
    if (action === "list_devices") {
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      const devices = await getDevices(cfg, hashRef);
      return json({ ok: true, devices: devices.map((d) => ({ id: d.id, name: d.name, imei: d.imei, online: d.online, lat: d.lat, lng: d.lng })) });
    }

    // ---- admin: vincular um device a uma conta (carro) ----
    if (action === "assign") {
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      const accountId = body.account_id as string | undefined;
      const deviceId = body.device_id != null ? Number(body.device_id) : null;
      const imei = body.imei ? String(body.imei) : null;
      if (!accountId) return json({ error: "account_id_obrigatorio" }, 400);
      await admin.from("accounts").update({ smartgps_device_id: deviceId, smartgps_imei: imei }).eq("id", accountId);
      return json({ ok: true });
    }

    // ---- resolve o carro do próprio usuário ----
    const { data: acct } = await admin.from("accounts")
      .select("id, placa, hodometro, smartgps_device_id, smartgps_imei")
      .eq("user_id", userId).eq("is_active", true).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!acct) return json({ error: "sem_veiculo" }, 400);

    const devices = await getDevices(cfg, hashRef);
    let device = matchDevice(devices, acct.smartgps_device_id, acct.smartgps_imei, acct.placa);

    // auto-vincula (persiste) quando achou por placa/imei e ainda não estava salvo
    if (device && (acct.smartgps_device_id == null || acct.smartgps_imei == null)) {
      await admin.from("accounts").update({ smartgps_device_id: Number(device.id), smartgps_imei: device.imei ?? null }).eq("id", acct.id);
    }

    if (action === "link_status") {
      return json({ ok: true, linked: !!device, device: device ? { id: device.id, name: device.name, imei: device.imei } : null });
    }

    if (!device) return json({ error: "rastreador_nao_vinculado" }, 404);

    // ---- posição ao vivo ----
    if (action === "live") {
      const flat = flatten(device);
      const lat = pickNum(flat, ["lat", "latitude"]);
      const lng = pickNum(flat, ["lng", "lon", "longitude"]);
      const speed = pickNum(flat, ["speed", "velocidade"]);
      const odometer = pickNum(flat, ["odometer", "odometro", "hodometro", "totaldistance", "distance", "mileage"]);
      const online = device.online ?? flat["online"] ?? null;
      const lastUpdate = device.last_update ?? flat["lastupdate"] ?? flat["time"] ?? flat["dt"] ?? null;
      const ignition = flat["ignition"] ?? flat["ign"] ?? null;

      let address: string | null = null;
      if (lat != null && lng != null) {
        try { const a = await apiGet(cfg, hashRef, "/api/geo_address", { lat: String(lat), lon: String(lng) }); address = a?.address ?? null; } catch { /* */ }
      }

      // sync hodômetro (regra só-sobe) → alimenta manutenção/alertas
      let hodometroAtualizado: number | null = null;
      if (odometer != null && Number(odometer) > Number(acct.hodometro || 0)) {
        await admin.from("accounts").update({ hodometro: odometer }).eq("id", acct.id);
        hodometroAtualizado = odometer;
      }

      return json({
        ok: true,
        device: { id: device.id, name: device.name, imei: device.imei, online, last_update: lastUpdate },
        position: { lat, lng, speed, ignition, address, odometer },
        hodometro_atualizado: hodometroAtualizado,
      });
    }

    // ---- histórico de trajeto ----
    if (action === "history") {
      const from = String(body.from || "");   // "YYYY-MM-DD HH:mm" ou só data
      const to = String(body.to || "");
      const [fd, ft = "00:00"] = from.split(/[ T]/);
      const [td, tt = "23:59"] = to.split(/[ T]/);
      if (!fd || !td) return json({ error: "periodo_invalido" }, 400);
      const qs: Record<string, string> = { from_date: fd, from_time: ft, to_date: td, to_time: tt };
      if (device.imei) qs.imei = String(device.imei); else qs.device_id = String(device.id);
      const data = await apiGet(cfg, hashRef, "/api/get_history", qs);
      const raw = data?.items?.data ?? data?.items ?? data?.data ?? [];
      const positions = (Array.isArray(raw) ? raw : []).map((r: any) => {
        const f = flatten(r);
        const pos = Array.isArray(r.position) ? r.position : null;
        return {
          lat: pos ? Number(pos[0]) : pickNum(f, ["lat", "latitude"]),
          lng: pos ? Number(pos[1]) : pickNum(f, ["lng", "lon", "longitude"]),
          speed: pickNum(f, ["speed"]),
          time: r.humanreadabledate ?? f["humanreadabledate"] ?? r.dt ?? r.timestamp ?? null,
          odometer: pickNum(f, ["odometer", "odometro", "totaldistance"]),
        };
      }).filter((p: any) => p.lat != null && p.lng != null);
      return json({ ok: true, count: positions.length, positions });
    }

    return json({ error: "acao_desconhecida" }, 400);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
