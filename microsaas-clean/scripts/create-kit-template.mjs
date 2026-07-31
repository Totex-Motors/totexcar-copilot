// TotexCar Co-pilot — cria o template boas_vindas_cortesia_pdf (HEADER DOCUMENT) na WABA.
// O header DOCUMENT exige um "header_handle" de exemplo, obtido pela Resumable Upload API
// (endpoint /app/uploads — o "app" é resolvido pelo próprio token do system user).
//
// USO:
//   node scripts/create-kit-template.mjs <WABA_ID> <TOKEN> <PDF_URL_OU_CAMINHO>
//   node scripts/create-kit-template.mjs <WABA_ID> <TOKEN> --status
//
// Espelho do registry supabase/functions/_shared/wa.ts (boas_vindas_cortesia_pdf).

import { readFileSync } from "node:fs";

const GRAPH = "https://graph.facebook.com/v21.0";
const WABA_ID = process.argv[2] || process.env.WABA_ID || "";
const TOKEN = process.argv[3] || process.env.META_WA_TOKEN || "";
const PDF = process.argv[4] || "";
const NAME = "boas_vindas_cortesia_pdf";

// ⚠️ Espelho de _shared/wa.ts — se mudar lá, mude aqui.
const BODY = "Olá {{1}}! 🎉 Obrigado por comprar seu {{2}} na {{3}}. Sua conta no TotexCar Co-pilot foi ativada com 1 ANO DE CORTESIA da loja. No guia em anexo você vê tudo o que seu novo assistente faz: gastos, consumo, revisões, multas e mais, direto neste WhatsApp. Responda esta mensagem para começar. 🚗";
const EXAMPLE = ["Kaiala", "Citroën C3", "Cardoso Veículos"];

if (!WABA_ID || !TOKEN || !PDF) {
  console.error("Uso: node scripts/create-kit-template.mjs <WABA_ID> <TOKEN> <PDF_URL_OU_CAMINHO | --status>");
  process.exit(1);
}

if (PDF === "--status") {
  const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates?fields=name,status,category&limit=100`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const j = await res.json();
  const t = (j.data || []).find((x) => x.name === NAME);
  console.log(t ? `${NAME}: ${t.status} (${t.category})` : `${NAME}: não existe na WABA`);
  process.exit(0);
}

// 1) bytes do PDF (URL ou arquivo local)
let bytes;
if (/^https?:\/\//i.test(PDF)) {
  const r = await fetch(PDF);
  if (!r.ok) { console.error(`falha ao baixar o PDF: HTTP ${r.status}`); process.exit(2); }
  bytes = Buffer.from(await r.arrayBuffer());
} else {
  bytes = readFileSync(PDF);
}
console.log(`PDF: ${(bytes.length / 1024).toFixed(0)} KB`);

// 2) sessão de upload resumable (o header_handle de exemplo do template)
const startRes = await fetch(
  `${GRAPH}/app/uploads?file_length=${bytes.length}&file_type=application/pdf&file_name=kit-boas-vindas.pdf&access_token=${encodeURIComponent(TOKEN)}`,
  { method: "POST" },
);
const startJ = await startRes.json();
if (!startRes.ok || !startJ.id) {
  console.error("falha ao abrir sessão de upload:", JSON.stringify(startJ?.error || startJ));
  process.exit(2);
}
const upRes = await fetch(`${GRAPH}/${startJ.id}`, {
  method: "POST",
  headers: { Authorization: `OAuth ${TOKEN}`, file_offset: "0", "Content-Type": "application/octet-stream" },
  body: bytes,
});
const upJ = await upRes.json();
if (!upRes.ok || !upJ.h) {
  console.error("falha no upload do PDF:", JSON.stringify(upJ?.error || upJ));
  process.exit(2);
}
console.log("upload ok, header_handle obtido");

// 3) cria o template com HEADER DOCUMENT + exemplo
const body = {
  name: NAME,
  language: "pt_BR",
  category: "MARKETING",
  allow_category_change: true,
  components: [
    { type: "HEADER", format: "DOCUMENT", example: { header_handle: [upJ.h] } },
    { type: "BODY", text: BODY, example: { body_text: [EXAMPLE] } },
  ],
};
const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify(body),
});
const j = await res.json();
if (res.ok) {
  console.log(`✅ ${NAME} criado (status inicial: ${j.status}, categoria: ${j.category})`);
} else {
  const msg = j?.error?.error_user_msg || j?.error?.message || JSON.stringify(j);
  if (/already exists|já existe/i.test(msg) || j?.error?.error_subcode === 2388023) {
    console.log(`↩️ ${NAME} já existe na WABA (pulado)`);
  } else {
    console.error(`❌ FALHOU: ${msg}`);
    process.exit(2);
  }
}
