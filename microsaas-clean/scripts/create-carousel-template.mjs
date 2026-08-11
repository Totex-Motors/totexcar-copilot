// Cria os templates CARROSSEL `vitrine_carros_2` … `vitrine_carros_10` na WABA (catálogo
// deslizável da Garagem Totex). Card: foto do carro (header IMAGE) + legenda {{1}} + botão URL
// "Ver carro" → totexmotors.com/veiculo/{{1}}.
//
// ⚠️ REGRA DA META (por isso são 9 templates): o carrossel é criado com um número FIXO de cards
// (mín. 2, máx. 10) e o envio SÓ pode ter exatamente essa quantidade. O vitrine_carros original
// foi criado com 1 card e a Meta renderizava 1 card por mensagem (sem deslizar) — aprovou fora
// de spec mas não funcionava. waSendCarousel escolhe `vitrine_carros_{n}` pelo nº de cards.
//
// USO: node scripts/create-carousel-template.mjs <WABA_ID> <TOKEN> [urlImagemExemplo]
//   (a imagem de exemplo padrão baixa uma foto de carro pública só para a aprovação —
//    não aparece nos envios reais; o mesmo upload é reutilizado em todos os cards)

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

// 2) cria um template por quantidade de cards (2..10), todos com a MESMA estrutura de card
// ⚠️ body do card: 72 chars fixos + variável — o webhook limita a variável a 88 (limite Meta: 160)
const card = {
  components: [
    { type: "HEADER", format: "IMAGE", example: { header_handle: [upJ.h] } },
    { type: "BODY", text: "🚗 {{1}} — toque em Ver carro para fotos, ficha completa e contato com a loja.", example: { body_text: [["Corolla XEI 2.0 2022 · R$ 139.900 · 38.000 km · 📍 Cardoso Veículos"]] } },
    {
      type: "BUTTONS",
      buttons: [{ type: "URL", text: "Ver carro", url: "https://totexmotors.com/veiculo/{{1}}", example: ["https://totexmotors.com/veiculo/abc123?ref=XYZ"] }],
    },
  ],
};

for (let n = 2; n <= 10; n++) {
  const body = {
    name: `vitrine_carros_${n}`,
    language: "pt_BR",
    category: "MARKETING",
    allow_category_change: true,
    components: [
      { type: "BODY", text: "Encontrei estas opções na Garagem Totex pra você 👇 Deslize pro lado e toque em Ver carro no que curtir. 🚗" },
      { type: "CAROUSEL", cards: Array.from({ length: n }, () => card) },
    ],
  };
  const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (res.ok) console.log(`✅ vitrine_carros_${n} criado (status inicial: ${j.status}, categoria: ${j.category})`);
  else console.error(`❌ vitrine_carros_${n} falhou:`, JSON.stringify(j?.error || j));
}
