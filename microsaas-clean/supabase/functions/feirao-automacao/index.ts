// TotexCar Co-pilot — Automação das AÇÕES DE FEIRÃO/SORTEIO (Ponte 1 e convite VIP).
// Roda diariamente (pg_cron). Tudo é CONFIGURÁVEL POR LOJA no card "Sorteio do Feirão"
// do painel (feirao_lojas.automacao no projeto do app de sorteio):
//   pos1 / pos2 → mensagens pós-ação para quem participou e NÃO ganhou (D+X e D+Y, texto livre)
//   vip         → convite da nova ação para clientes Selo Prata/Ouro da loja
// Envio pelo template-coringa `campanha_loja` (iniciado pelo negócio → template aprovado; ver _shared/wa.ts).
// Dedup por feirao_envios (evento+telefone+etapa). A renovação da cortesia NÃO está aqui —
// já é automática no car-expiration-alerts (marcos 30/15/7/1/0).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { loadWaSettings, waSendTemplate } from "../_shared/wa.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// mesmo secret dos crons existentes (query ?secret=) — fallback fixo porque a env não está definida no projeto
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || "TCF-uaz-2026-7Kp9Qm3Xv8Rn";
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Banco do app de sorteio (projeto TotexMotors OS) — leitura/registro via REST com a chave publishable.
const FEIRAO_URL = "https://fbgtqiqovwxccinbzvmx.supabase.co";
const FEIRAO_KEY = "sb_publishable_7FBkjLTMpozEHHcgucNA1g_xTNWsrfp";
const FH = { apikey: FEIRAO_KEY, Authorization: `Bearer ${FEIRAO_KEY}`, "Content-Type": "application/json" };

async function fGet(path: string): Promise<any[]> {
  try {
    const r = await fetch(`${FEIRAO_URL}/rest/v1/${path}`, { headers: FH });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}
async function fPost(path: string, body: unknown): Promise<boolean> {
  try {
    const r = await fetch(`${FEIRAO_URL}/rest/v1/${path}`, { method: "POST", headers: FH, body: JSON.stringify(body) });
    return r.ok;
  } catch { return false; }
}

const DIA = 86_400_000;
const LIMITE_POR_RODADA = 150; // trava de segurança contra disparo em massa acidental
const dig = (s: unknown) => String(s || "").replace(/\D/g, "");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (WEBHOOK_SECRET && url.searchParams.get("secret") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const wa = await loadWaSettings(supabase);
  const agora = Date.now();
  let enviados = 0;
  const resumo: Record<string, number> = { pos1: 0, pos2: 0, vip: 0 };

  const lojas = await fGet("feirao_lojas?select=*");
  for (const loja of lojas) {
    if (enviados >= LIMITE_POR_RODADA) break;
    const cfg = (loja.automacao || {}) as Record<string, { on?: boolean; dias?: number; msg?: string }>;

    // ---------- pós-ação: quem participou e não ganhou ----------
    const etapas = (["pos1", "pos2"] as const).filter((k) => cfg[k]?.on && cfg[k]?.msg);
    if (etapas.length) {
      const eventos = await fGet(`feirao_eventos?select=*&loja=eq.${loja.id}&order=criado_em.desc&limit=5`);
      for (const ev of eventos) {
        const sorteio = new Date(ev.sorteio_em).getTime();
        // só ações já sorteadas e recentes (até 45 dias) — nunca ressuscita lista antiga
        if (!(sorteio <= agora && agora - sorteio <= 45 * DIA)) continue;
        const ganhadores = await fGet(`feirao_ganhadores?select=zap&evento_id=eq.${ev.id}`);
        if (!ganhadores.length) continue; // sorteio ainda não realizado
        const venceu = new Set(ganhadores.map((g: any) => dig(g.zap)));
        let cadastros: any[] | null = null;
        for (const etapa of etapas) {
          const c = cfg[etapa]!;
          const alvo = sorteio + Math.max(0, Number(c.dias) || 0) * DIA;
          // dispara no dia certo, com janela de 3 dias (se o cron falhar um dia, ainda envia)
          if (!(agora >= alvo && agora - alvo <= 3 * DIA)) continue;
          cadastros ??= await fGet(`feirao_cadastros?select=nome,zap,zap_limpo&evento_id=eq.${ev.id}`);
          const ja = new Set((await fGet(`feirao_envios?select=zap_limpo&evento_id=eq.${ev.id}&etapa=eq.${etapa}`))
            .map((x: any) => x.zap_limpo));
          for (const p of cadastros) {
            if (enviados >= LIMITE_POR_RODADA) break;
            if (venceu.has(dig(p.zap)) || ja.has(p.zap_limpo)) continue;
            const primeiro = String(p.nome || "").split(" ")[0] || "tudo bem";
            const texto = String(c.msg).replace(/\{nome\}/gi, primeiro);
            const ok = await waSendTemplate(wa, dig(p.zap), "campanha_loja", [primeiro, loja.nome, texto]);
            if (ok) {
              enviados++; resumo[etapa]++;
              await fPost("feirao_envios", { loja: loja.id, evento_id: ev.id, zap_limpo: p.zap_limpo, etapa });
            }
          }
        }
      }
    }

    // ---------- convite VIP: clientes Selo Prata/Ouro da loja, para a PRÓXIMA ação ----------
    if (cfg.vip?.on && cfg.vip?.msg) {
      const evs = await fGet(`feirao_eventos?select=*&loja=eq.${loja.id}&ativo=eq.true&order=criado_em.desc&limit=1`);
      const ev = evs[0];
      if (ev && new Date(ev.sorteio_em).getTime() > agora) {
        const ja = new Set((await fGet(`feirao_envios?select=zap_limpo&evento_id=eq.${ev.id}&etapa=eq.vip`))
          .map((x: any) => x.zap_limpo));
        const { data: vips } = await supabase.from("users")
          .select("name, phone").eq("role", "owner").eq("dealership", loja.nome)
          .in("care_tier", ["prata", "ouro"]).not("phone", "is", null).limit(200);
        const quando = new Date(ev.sorteio_em).toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
        });
        for (const u of vips || []) {
          if (enviados >= LIMITE_POR_RODADA) break;
          const zl = dig(u.phone);
          if (!zl || ja.has(zl)) continue;
          const primeiro = String(u.name || "").split(" ")[0] || "tudo bem";
          const texto = String(cfg.vip.msg)
            .replace(/\{nome\}/gi, primeiro)
            .replace(/\{acao\}/gi, ev.titulo || "nossa nova ação")
            .replace(/\{quando\}/gi, quando);
          const ok = await waSendTemplate(wa, zl, "campanha_loja", [primeiro, loja.nome, texto]);
          if (ok) {
            enviados++; resumo.vip++;
            await fPost("feirao_envios", { loja: loja.id, evento_id: ev.id, zap_limpo: zl, etapa: "vip" });
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, enviados, ...resumo }), {
    headers: { "Content-Type": "application/json" },
  });
});
