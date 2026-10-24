// TotexCar Co-pilot — recebe o aviso de MULTA NOVA do BI da Cardoso (financeiro_cardoso) e
// notifica o DONO do carro no WhatsApp. Autenticado por um segredo compartilhado (x-totexcar-secret).
// Só dados da multa (do carro). Deploy com verify_jwt=false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { loadWaSettings, waSendText } from "../_shared/wa.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const soDigitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "method" }, 405);
  if (req.headers.get("x-totexcar-secret") !== Deno.env.get("MULTA_SECRET")) return json({ erro: "nao autorizado" }, 401);

  const m = await req.json().catch(() => ({}));
  const placa = String(m?.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (m?.evento !== "multa_nova" || !placa) return json({ erro: "payload" }, 400);

  // dono do carro pela placa
  const { data: veic } = await admin.from("vehicles").select("user_id, placa").ilike("placa", placa).limit(1);
  const userId = veic?.[0]?.user_id;
  if (!userId) return json({ ok: true, ignorado: "placa sem dono no app" });
  const { data: usr } = await admin.from("users").select("phone, name").eq("id", userId).limit(1);
  const fone = soDigitos(usr?.[0]?.phone);
  if (!fone) return json({ ok: true, ignorado: "dono sem telefone" });

  const texto = [
    `🚦 *Nova multa no seu ${m.veiculo || "veículo"}* (${placa})`,
    m.orgao ? `Órgão: ${m.orgao}` : "",
    m.descricao ? `Infração: ${m.descricao}` : "",
    m.data_infracao ? `Data: ${m.data_infracao}` : "",
    m.vencimento ? `Vencimento: ${m.vencimento}` : "",
    (m.pontos ? `Pontos: ${m.pontos}` : ""),
    m.prazo_indicacao ? `⚠️ Indicação de condutor até ${m.prazo_indicacao}` : "",
    "",
    "Qualquer dúvida sobre a multa, é só me chamar aqui.",
  ].filter(Boolean).join("\n");

  try {
    const wa = await loadWaSettings(admin);
    await waSendText(wa, fone, texto);
  } catch (e) {
    return json({ ok: false, erro: String((e as any)?.message || e) }, 500);
  }
  return json({ ok: true });
});
