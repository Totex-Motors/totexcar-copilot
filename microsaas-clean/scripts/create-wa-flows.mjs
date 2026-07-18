// TotexCar Co-pilot — cria/atualiza/publica os WhatsApp FLOWS via Graph API
// Os 3 flows antigos (NPS, Recompra, Garagem) foram criados na mão no Flow Builder.
// Este script faz o ciclo inteiro pela API: criar → subir o JSON → validar → publicar.
//
// USO:
//   node scripts/create-wa-flows.mjs <WABA_ID> <TOKEN>                  → cria/atualiza todos
//   node scripts/create-wa-flows.mjs <WABA_ID> <TOKEN> radar            → só um
//   node scripts/create-wa-flows.mjs <WABA_ID> <TOKEN> --list           → lista os flows e ids
//   node scripts/create-wa-flows.mjs <WABA_ID> <TOKEN> radar --publish  → publica (deixa no ar)
//
// Também aceita env: WABA_ID / META_WA_TOKEN. Node 18+ (fetch nativo).
//
// ⚠️ Publicar é IRREVERSÍVEL para aquela versão: flow publicado não pode ser editado,
// só substituído por uma nova versão. Por isso o publish é opt-in via --publish.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const GRAPH = "https://graph.facebook.com/v21.0";
const __dirname = dirname(fileURLToPath(import.meta.url));
const FLOWS_DIR = resolve(__dirname, "../supabase/flows");

const WABA_ID = process.argv[2] || process.env.WABA_ID || "";
const TOKEN = process.argv[3] || process.env.META_WA_TOKEN || "";
const ARGS = process.argv.slice(4);
const ALVO = ARGS.find((a) => !a.startsWith("--"));
const LIST = ARGS.includes("--list");
const PUBLISH = ARGS.includes("--publish");

if (!WABA_ID || !TOKEN) {
  console.error("Uso: node scripts/create-wa-flows.mjs <WABA_ID> <TOKEN> [nome] [--list] [--publish]");
  process.exit(1);
}

// nome do flow → arquivo JSON + categorias exigidas pela Meta
const FLOWS = {
  radar_servicos: {
    file: "radar-flow.json",
    categories: ["OTHER"],
    endpoint: true,
    descricao: "Radar de Serviços — acha oficina/borracharia/guincho perto do motorista",
  },
  modo_viagem: {
    file: "viagem-flow.json",
    categories: ["OTHER"],
    endpoint: false, // formulário puro: o plano é montado no chat (evita timeout do endpoint)
    descricao: "Modo Viagem — formulário do plano de viagem com o consumo real do carro",
  },
};

async function graph(path, init = {}) {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) },
  });
  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

async function listar() {
  const d = await graph(`/${WABA_ID}/flows?fields=id,name,status,categories,validation_errors&limit=50`);
  return d?.data || [];
}

async function upsert(nome, def) {
  const existentes = await listar();
  const achado = existentes.find((f) => f.name === nome);

  let flowId = achado?.id;
  if (achado) {
    if (achado.status === "PUBLISHED") {
      console.log(`  ⚠️  ${nome} já está PUBLICADO (id ${flowId}) — flow publicado não aceita edição.`);
      console.log(`      Para mudar, crie uma versão nova no Flow Builder ou use outro nome.`);
      return flowId;
    }
    console.log(`  ↻ ${nome} já existe (id ${flowId}, ${achado.status}) — atualizando o JSON`);
  } else {
    const criado = await graph(`/${WABA_ID}/flows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nome,
        categories: def.categories,
        ...(def.endpoint ? { flow_json_version: "7.0" } : {}),
      }),
    });
    flowId = criado.id;
    console.log(`  ✓ ${nome} criado (id ${flowId})`);
  }

  // sobe o JSON das telas (multipart: asset_type=FLOW_JSON)
  const conteudo = readFileSync(resolve(FLOWS_DIR, def.file), "utf8");
  const form = new FormData();
  form.append("asset_type", "FLOW_JSON");
  form.append("name", def.file);
  form.append("file", new Blob([conteudo], { type: "application/json" }), def.file);

  const up = await graph(`/${flowId}/assets`, { method: "POST", body: form });
  const erros = up?.validation_errors || [];
  if (erros.length) {
    console.log(`  ✗ ${nome}: ${erros.length} erro(s) de validação`);
    for (const e of erros.slice(0, 6)) console.log(`      · ${e.error_type || ""} ${e.message || JSON.stringify(e)}`);
    return flowId;
  }
  console.log(`  ✓ ${nome}: JSON válido`);

  if (PUBLISH) {
    await graph(`/${flowId}/publish`, { method: "POST" });
    console.log(`  🚀 ${nome} PUBLICADO`);
  } else {
    console.log(`     (rode com --publish para publicar)`);
  }
  return flowId;
}

const alvos = ALVO
  ? Object.entries(FLOWS).filter(([n]) => n.includes(ALVO))
  : Object.entries(FLOWS);

if (LIST) {
  const fs = await listar();
  console.log(`\n${fs.length} flow(s) na WABA ${WABA_ID}:\n`);
  for (const f of fs) {
    console.log(`  ${String(f.status).padEnd(10)} ${String(f.id).padEnd(20)} ${f.name}`);
    for (const e of f.validation_errors || []) console.log(`      ✗ ${e.message || JSON.stringify(e)}`);
  }
  console.log("");
  process.exit(0);
}

if (!alvos.length) {
  console.error(`Nenhum flow bate com "${ALVO}". Disponíveis: ${Object.keys(FLOWS).join(", ")}`);
  process.exit(1);
}

console.log(`\nProcessando ${alvos.length} flow(s) na WABA ${WABA_ID}:\n`);
const ids = {};
for (const [nome, def] of alvos) {
  console.log(`▸ ${nome} — ${def.descricao}`);
  try {
    ids[nome] = await upsert(nome, def);
  } catch (e) {
    console.log(`  ✗ falhou: ${e.message}`);
  }
  console.log("");
}

console.log("IDs (para os secrets do Supabase):");
if (ids.radar_servicos) console.log(`  RADAR_FLOW_ID=${ids.radar_servicos}`);
if (ids.modo_viagem)    console.log(`  VIAGEM_FLOW_ID=${ids.modo_viagem}`);
console.log(`
Depois de publicar, configure:
  1. supabase secrets set RADAR_FLOW_ID=<id> VIAGEM_FLOW_ID=<id> --project-ref gkkjhnzkqhpgrwrmofev
  2. No Flow Builder, aponte o ENDPOINT do flow "radar_servicos" para:
     https://gkkjhnzkqhpgrwrmofev.supabase.co/functions/v1/wa-flow-endpoint
     (o "modo_viagem" NÃO usa endpoint — é formulário puro)
  3. Redeploy do whatsapp-webhook para ler os secrets novos.
`);
