// TotexCar Co-pilot — ROLETA TOTEX (giro conquistado)
// O cliente NÃO gira de graça: cada giro é destravado por uma missão que gera valor pra loja
// (avaliar no Google, seguir o Instagram, engajar no Co-pilot). O lojista configura fatias,
// pesos e ESTOQUE por prêmio — a roleta nunca estoura o orçamento da loja.
//
// Ações do CLIENTE (role owner): estado | girar
// Ações da LOJA (dealer/admin):  cfg | cfg_save | liberar | resgates | entregar
// Sorteio da fatia acontece AQUI (service role), nunca no navegador.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Fatia = { rotulo: string; peso: number; estoque: number | null; cor?: string };

// Missões da Fase 1. As "auto" são verificadas em código; as "validadas" a equipe libera no painel.
const MISSOES: Record<string, { titulo: string; como: string; auto: boolean }> = {
  gastos5: { titulo: "Registrar 5 gastos do carro no Co-pilot (últimos 7 dias)", como: "Registre 5 gastos nesta semana — vale foto de comprovante no WhatsApp.", auto: true },
  nps: { titulo: "Responder a pesquisa de satisfação da loja", como: "Responda a pesquisa que chegou no seu WhatsApp após a compra.", auto: true },
  google: { titulo: "Avaliar a loja no Google", como: "Avalie a loja no Google e mostre ao vendedor para liberar seu giro.", auto: false },
  instagram: { titulo: "Seguir a loja no Instagram", como: "Siga o perfil da loja e mostre ao vendedor para liberar seu giro.", auto: false },
};

function novoCodigo(rotulo: string): string {
  const pref = (rotulo.normalize("NFD").replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "PRM").slice(0, 3);
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
  return `${pref}-${String(n).padStart(4, "0")}`;
}

async function usadosPorPremio(dealership: string): Promise<Record<string, number>> {
  const { data } = await admin.from("roleta_giros")
    .select("premio").eq("dealership", dealership).in("status", ["girado", "entregue"]);
  const m: Record<string, number> = {};
  (data || []).forEach((g: any) => { if (g.premio) m[g.premio] = (m[g.premio] || 0) + 1; });
  return m;
}

// Sorteia a fatia respeitando peso e estoque restante.
function sortearFatia(fatias: Fatia[], usados: Record<string, number>): Fatia | null {
  const elegiveis = fatias.filter((f) =>
    Number(f.peso) > 0 && (f.estoque == null || (usados[f.rotulo] || 0) < Number(f.estoque)));
  if (!elegiveis.length) return null;
  const total = elegiveis.reduce((s, f) => s + Number(f.peso), 0);
  let alvo = (crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF) * total;
  for (const f of elegiveis) { alvo -= Number(f.peso); if (alvo <= 0) return f; }
  return elegiveis[elegiveis.length - 1];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !ud?.user) return json({ error: "invalid_token" }, 401);
  const { data: me } = await admin.from("users")
    .select("id, name, phone, role, dealership").eq("id", ud.user.id).single();
  if (!me) return json({ error: "no_profile" }, 403);

  let p: any = {};
  try { p = await req.json(); } catch { /* GET sem body */ }
  const action = String(p.action || "estado");
  const isStaff = me.role === "dealer" || me.role === "admin";

  try {
    // =================== CLIENTE ===================
    if (action === "estado") {
      const loja = me.dealership;
      if (!loja) return json({ ok: true, ativo: false });
      const { data: cfg } = await admin.from("roleta_config").select("*").eq("dealership", loja).maybeSingle();
      if (!cfg?.ativo) return json({ ok: true, ativo: false, loja });

      const missoesOn = Object.keys(MISSOES).filter((k) => (cfg.missoes || {})[k]?.on);

      // missões AUTO: concede o giro na hora, idempotente (índice único user+missão)
      for (const k of missoesOn) {
        if (!MISSOES[k].auto) continue;
        let cumpriu = false;
        if (k === "gastos5") {
          const desde = new Date(Date.now() - 7 * 86_400_000).toISOString().split("T")[0];
          const { count } = await admin.from("transactions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", me.id).gte("transaction_date", desde);
          cumpriu = (count || 0) >= 5;
        } else if (k === "nps") {
          const { data: j } = await admin.from("postsale_journeys")
            .select("id").eq("user_id", me.id).not("nps_score", "is", null).limit(1);
          cumpriu = !!j?.length;
        }
        if (cumpriu) {
          await admin.from("roleta_giros")
            .insert({ user_id: me.id, dealership: loja, missao: k })
            .then(() => {}, () => {}); // conflito no índice único = já tinha o giro
        }
      }

      const { data: giros } = await admin.from("roleta_giros")
        .select("*").eq("user_id", me.id).order("criado_em", { ascending: true });
      const feitos = new Set((giros || []).map((g: any) => g.missao));
      const missoes = missoesOn.map((k) => ({
        id: k, ...MISSOES[k],
        status: feitos.has(k) ? "conquistada" : (MISSOES[k].auto ? "em_andamento" : "aguardando_validacao"),
      }));
      return json({
        ok: true, ativo: true, loja,
        fatias: (cfg.fatias || []).map((f: Fatia) => ({ rotulo: f.rotulo, cor: f.cor || null })),
        missoes,
        disponiveis: (giros || []).filter((g: any) => g.status === "disponivel"),
        premios: (giros || []).filter((g: any) => g.status !== "disponivel"),
      });
    }

    if (action === "girar") {
      const { data: giro } = await admin.from("roleta_giros")
        .select("*").eq("id", String(p.giro_id || "")).eq("user_id", me.id).single();
      if (!giro || giro.status !== "disponivel") return json({ error: "giro_indisponivel" }, 400);
      const { data: cfg } = await admin.from("roleta_config").select("*").eq("dealership", giro.dealership).maybeSingle();
      if (!cfg?.ativo) return json({ error: "roleta_inativa" }, 400);

      const usados = await usadosPorPremio(giro.dealership);
      const fatia = sortearFatia((cfg.fatias || []) as Fatia[], usados);
      if (!fatia) return json({ error: "sem_premios" }, 400);

      const codigo = novoCodigo(fatia.rotulo);
      // trava de corrida: só atualiza se ainda estiver 'disponivel'
      const { data: upd } = await admin.from("roleta_giros")
        .update({ status: "girado", premio: fatia.rotulo, codigo, girado_em: new Date().toISOString() })
        .eq("id", giro.id).eq("status", "disponivel").select("id");
      if (!upd?.length) return json({ error: "giro_indisponivel" }, 400);
      return json({ ok: true, premio: fatia.rotulo, codigo });
    }

    // =================== LOJA ===================
    if (!isStaff) return json({ error: "forbidden" }, 403);
    const lojaStaff = me.role === "admin" ? String(p.dealership || me.dealership || "") : (me.dealership || "");
    if (!lojaStaff) return json({ error: "sem_loja" }, 400);

    if (action === "cfg") {
      const { data: cfg } = await admin.from("roleta_config").select("*").eq("dealership", lojaStaff).maybeSingle();
      return json({ ok: true, config: cfg || null, missoes_catalogo: MISSOES });
    }

    if (action === "cfg_save") {
      const fatias = Array.isArray(p.fatias) ? p.fatias.slice(0, 12).map((f: any) => ({
        rotulo: String(f.rotulo || "").slice(0, 60),
        peso: Math.max(0, Number(f.peso) || 0),
        estoque: f.estoque === null || f.estoque === "" || f.estoque === undefined ? null : Math.max(0, Number(f.estoque) || 0),
        cor: String(f.cor || "").slice(0, 20) || null,
      })).filter((f: any) => f.rotulo) : [];
      const missoes: Record<string, { on: boolean }> = {};
      for (const k of Object.keys(MISSOES)) missoes[k] = { on: !!(p.missoes || {})[k]?.on };
      const { error } = await admin.from("roleta_config").upsert({
        dealership: lojaStaff, ativo: !!p.ativo, fatias, missoes, atualizado_em: new Date().toISOString(),
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "liberar") {
      // valida uma missão manual (Google/Instagram): concede o giro ao cliente pelo telefone
      const fone = String(p.phone || "").replace(/\D/g, "");
      const missao = String(p.missao || "");
      if (!MISSOES[missao] || MISSOES[missao].auto) return json({ error: "missao_invalida" }, 400);
      if (fone.length < 10) return json({ error: "telefone_invalido" }, 400);
      const { data: alvo } = await admin.from("users")
        .select("id, name, phone").eq("role", "owner").eq("dealership", lojaStaff)
        .ilike("phone", `%${fone.slice(-8)}`).limit(1);
      if (!alvo?.length) return json({ error: "cliente_nao_encontrado" }, 404);
      const { error } = await admin.from("roleta_giros")
        .insert({ user_id: alvo[0].id, dealership: lojaStaff, missao });
      if (error) return json({ error: "ja_liberado" }, 409);
      return json({ ok: true, cliente: alvo[0].name });
    }

    if (action === "resgates") {
      const { data: giros } = await admin.from("roleta_giros")
        .select("*").eq("dealership", lojaStaff).in("status", ["girado", "entregue"])
        .order("girado_em", { ascending: false }).limit(100);
      const ids = [...new Set((giros || []).map((g: any) => g.user_id))];
      const nomes: Record<string, string> = {};
      if (ids.length) {
        const { data: us } = await admin.from("users").select("id, name, phone").in("id", ids);
        (us || []).forEach((u: any) => { nomes[u.id] = `${u.name || "Cliente"} · ${u.phone || ""}`; });
      }
      const usados = await usadosPorPremio(lojaStaff);
      return json({
        ok: true, usados,
        giros: (giros || []).map((g: any) => ({ ...g, cliente: nomes[g.user_id] || "Cliente" })),
      });
    }

    if (action === "entregar") {
      const { error } = await admin.from("roleta_giros")
        .update({ status: "entregue", entregue_em: new Date().toISOString() })
        .eq("id", String(p.giro_id || "")).eq("dealership", lojaStaff).eq("status", "girado");
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "acao_desconhecida" }, 400);
  } catch (e) {
    console.error("roleta:", e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
