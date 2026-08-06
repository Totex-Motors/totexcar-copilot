// Cria o template CARROSSEL `vitrine_carros` na WABA (catálogo deslizável da Garagem Totex).
// Card: foto do carro (header IMAGE) + legenda {{1}} + botão URL "Ver carro" → totexmotors.com/veiculo/{{1}}.
// A foto/legenda/link são DINÂMICOS a cada envio; a Meta aprova a estrutura uma vez.
//
// USO: node scripts/create-carousel-template.mjs <WABA_ID> <TOKEN> [urlImagemExemplo]
//   (mesmo WABA_ID/token do create-wa-templates.mjs; a imagem de exemplo padrão baixa
//    uma foto de carro pública só para a aprovação — não aparece nos envios reais)

const GRAPH = "https://graph.facebook.com/v21.0";
const WABA_ID = process.argv[2] || process.env.WABA_ID;
const TOKEN = process.argv[3] || process.env.META_WA_TOKEN;
const IMG = process.argv[4] || "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=1080&q=80&fm=jpg";
if (!WABA_ID || !TOKEN) { console.error("Uso: node scripts/create-carousel-template.mjs <WABA_ID> <TOKEN> [imgExemplo]"); process.exit(1); }

// 1) baixa a imagem de exemplo e faz o upload resumable (header_handle exigido pela aprovação)
const r = await fetch(IMG);
if (!r.ok) { console.error(`falha ao baixar imagem de exemplo: HTTP ${r.status}`); process.exit(2); }
const bytes = Buffer.from(await r.arrayBuffer());
console.log(`imagem de exemplo: ${(bytes.length / 1024).toFixed(0)} KB`);

const startRes = await fetch(
  `${GRAPH}/app/uploads?file_length=${bytes.length}&file_type=image/jpeg&file_name=vitrine.jpg&access_token=${encodeURIComponent(TOKEN)}`,
  { method: "POST" },
);
const startJ = await startRes.json();
if (!startRes.ok || !startJ.id) { console.error("falha ao abrir upload:", JSON.stringify(startJ?.error || startJ)); process.exit(2); }
const upRes = await fetch(`${GRAPH}/${startJ.id}`, {
  method: "POST",
  headers: { Authorization: `OAuth ${TOKEN}`, file_offset: "0", "Content-Type": "application/octet-stream" },
  body: bytes,
});
const upJ = await upRes.json();
if (!upRes.ok || !upJ.h) { console.error("falha no upload:", JSON.stringify(upJ?.error || upJ)); process.exit(2); }
console.log("upload ok, header_handle obtido");

// 2) cria o template carrossel (1 card de estrutura; os envios mandam até 10 cards iguais em formato)
const card = {
  components: [
    { type: "HEADER", format: "IMAGE", example: { header_handle: [upJ.h] } },
    { type: "BODY", text: "{{1}}", example: { body_text: [["Corolla XEI 2.0 2022 · R$ 139.900 · 38.000 km · 📍 Cardoso Veículos"]] } },
    {
      type: "BUTTONS",
      buttons: [{ type: "URL", text: "Ver carro", url: "https://totexmotors.com/veiculo/{{1}}", example: ["https://totexmotors.com/veiculo/abc123?ref=XYZ"] }],
    },
  ],
};
const body = {
  name: "vitrine_carros",
  language: "pt_BR",
  category: "MARKETING",
  allow_category_change: true,
  components: [
    { type: "BODY", text: "Encontrei estas opções na Garagem Totex pra você 👇 Deslize pro lado e toque em Ver carro no que curtir. 🚗" },
    { type: "CAROUSEL", cards: [card] },
  ],
};
const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify(body),
});
const j = await res.json();
if (res.ok) console.log(`✅ vitrine_carros criado (status inicial: ${j.status}, categoria: ${j.category})`);
else console.error("❌ falhou:", JSON.stringify(j?.error || j));
