// Capturas da aula "Como levar o carro pra oficina e trazer de volta" (apoio de manutenção: Léo e Jorginho)
// TELA REAL do link da oficina (/oficina/:token) com DADOS DE DEMONSTRAÇÃO (API simulada; placa fictícia).
// Pré-requisito: build de demonstração servido em 127.0.0.1:4179 (ver LEIAME.md da aula da oficina).
const pw = require("playwright");
const fs = require("fs");
const DIR = __dirname;
const agora = () => new Date().toISOString();
const SERV = { troca_oleo: "troca de óleo e filtro", revisao: "revisão", outro: "outro serviço" };
const oficinas = [
  { id: "pires", nome: "Pires Transmissão", responsavel: "Jackson", whatsapp: "5511979563948", cidade: "Carapicuíba", ativo: true, link: "https://copilot.totexmotors.com/parceiro/demo1" },
  { id: "ltl", nome: "LTL Auto Center", responsavel: "Flávio", whatsapp: "5511947757106", cidade: "Osasco", ativo: true, link: "https://copilot.totexmotors.com/parceiro/demo2" },
  { id: "nc", nome: "New Car", responsavel: "Nilton", whatsapp: "5511940342499", cidade: "Carapicuíba", ativo: true, link: "https://copilot.totexmotors.com/parceiro/demo3" },
];
const carros = [
  { id: "v1", desc: "Chevrolet Onix 2022", versao: "1.0 LT", cor: "prata", placa: "ABC1D23", preco: 72900, km: 48200, capa: null, preparacao: null, os: null },
  { id: "v2", desc: "Hyundai HB20 2021", versao: "1.0 Vision", cor: "branco", placa: "BRA2E19", preco: 64900, km: 30110, capa: null, preparacao: null, os: null },
  { id: "v3", desc: "Chevrolet Tracker 2020", versao: "1.0 Turbo LT", cor: "cinza", placa: "FJK3C45", preco: 89900, km: 61500, capa: null, preparacao: null, os: { numero: 15, status: "recebida", oficina: "LTL Auto Center" } },
];
const ordens = [];
const resp = (a, q) => {
  if (a === "link_me") return { ok: true, nome: "Léo", papel: "apoio_manutencao", loja: "Cardoso Veículos" };
  if (a === "oficinas_lista") return { ok: true, oficinas };
  if (a === "os_lista") return { ok: true, servicos: SERV, ordens };
  if (a === "estoque_lista") return { ok: true, carros };
  if (a === "preparacao_lista") return { ok: true, preparacoes: [] };
  if (a === "oficina_trocas") return { ok: true, resumo: {}, lista: [] };
  if (a === "os_criar") {
    ordens.unshift({ id: "os14", numero: 14, dealership: "Cardoso Veículos", oficina_id: q.oficina_id, oficina_nome: oficinas.find((o) => o.id === q.oficina_id)?.nome, vehicle_id: q.vehicle_id, car_desc: q.car_desc, placa: q.placa,
      servicos: q.servicos, status: "enviada", pedido_obs: q.pedido_obs || null, enviada_por: "Léo", enviada_em: agora(), km_saida: q.km_saida, fotos: { foto_saida: q.foto_saida },
      recebida_em: null, km_chegada: null, concluida_em: null, km_servico: null, km_ida: null, horas_na_oficina: 0, atrasada: false, extra_status: null, devolvida_em: null, km_volta: null, devolvida_por: null });
    const c = carros.find((x) => x.id === q.vehicle_id); if (c) c.os = { numero: 14, status: "enviada", oficina: "Pires Transmissão" };
    return { ok: true, numero: 14 };
  }
  if (a === "os_devolver") { Object.assign(ordens[0], { status: "devolvida", devolvida_em: agora(), km_volta: q.km_volta, devolvida_por: "Léo" }); return { ok: true }; }
  return { ok: true };
};
(async () => {
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.addInitScript(() => { try { localStorage.removeItem("os:envio-rascunho"); } catch {} });
  await p.route("**/functions/v1/dealer-api", async (r) => { const q = JSON.parse(r.request().postData() || "{}"); await r.fulfill({ json: resp(q.action, q), headers: { "access-control-allow-origin": "*" } }); });
  const caixas = {};
  const shot = async (n, alvos = []) => {
    await p.waitForTimeout(500); await p.screenshot({ path: `${DIR}/capturas/${n}.png` });
    caixas[n] = {};
    for (const [nome, loc] of alvos) { const bb = await loc.first().boundingBox().catch(() => null); if (bb) caixas[n][nome] = bb; }
    console.log("ok", n);
  };
  const dlg = () => p.locator('[role="dialog"]');
  const campo = (rotulo) => dlg().locator("div.space-y-1", { hasText: rotulo }).first().locator("input").first();
  await p.goto("http://127.0.0.1:4179/oficina/" + "E".repeat(24)); await p.waitForTimeout(1800);
  await shot("a01-link", [["mandar", p.getByRole("button", { name: /Mandar carro pra oficina/ })]]);
  await p.getByRole("button", { name: /Mandar carro pra oficina/ }).click(); await p.waitForTimeout(500);
  await dlg().getByRole("button", { name: /Pires Transmissão/ }).click();
  await shot("a02-oficina", [["pires", dlg().getByRole("button", { name: /Pires Transmissão/ })]]);
  await dlg().getByPlaceholder(/Buscar modelo/).fill("abc1d23");
  await dlg().getByPlaceholder(/Buscar modelo/).scrollIntoViewIfNeeded();
  await shot("a03-busca-placa", [["busca", dlg().getByPlaceholder(/Buscar modelo/)], ["placa", dlg().locator("b", { hasText: "ABC1D23" })]]);
  await dlg().getByRole("button", { name: /Chevrolet Onix 2022/ }).click(); await p.waitForTimeout(300);
  await campo("Placa").scrollIntoViewIfNeeded();
  await shot("a04-carro-placa", [["placa", campo("Placa")], ["cadastro", dlg().getByText(/Placa no cadastro/)]]);
  await dlg().locator("div.space-y-1", { hasText: "Foto do painel na saída" }).first().locator('input[type="file"]').first().setInputFiles(`${DIR}/ilustracoes/painel-48200.jpg`);
  await p.waitForTimeout(700);
  await dlg().evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await shot("a05-km-foto-enviar", [["km", campo("Km do painel na saída")], ["foto", dlg().locator("div.space-y-1", { hasText: "Foto do painel na saída" }).locator("button").first()], ["enviar", dlg().getByRole("button", { name: "Enviar e avisar a oficina" })]]);
  await dlg().getByRole("button", { name: "Enviar e avisar a oficina" }).click(); await p.waitForTimeout(6000);
  await shot("a06-a-caminho", [["os", p.getByText(/#14 · Chevrolet Onix/)], ["status", p.getByText("A caminho da oficina").first()]]);
  // a oficina confirma a chegada e registra o serviço (no link dela) → aqui só muda o estado
  Object.assign(ordens[0], { status: "concluida", recebida_em: agora(), km_chegada: 48210, km_ida: 10, concluida_em: agora(), km_servico: 48212, oleo_viscosidade: "5W30", oleo_norma: "API SP", oleo_marca: "Lubrax", oleo_litros: 3.5, filtro_oleo: true });
  await p.reload(); await p.waitForTimeout(1800);
  await shot("a07-pronto", [["status", p.getByText("Pronto p/ buscar").first()], ["oleo", p.getByText(/5W30 · API SP/)], ["voltou", p.getByRole("button", { name: "Carro voltou pra loja" })]]);
  await p.getByRole("button", { name: "Carro voltou pra loja" }).click(); await p.waitForTimeout(400);
  await campo("Km do painel na volta").fill("48215");
  await shot("a08-volta", [["km", campo("Km do painel na volta")], ["confirmar", dlg().getByRole("button", { name: "Confirmar" })]]);
  await dlg().getByRole("button", { name: "Confirmar" }).click(); await p.waitForTimeout(6000);
  await p.getByRole("button", { name: /^Todas/ }).click(); await p.waitForTimeout(300);
  await p.getByText(/#14 · Chevrolet Onix/).click(); await p.waitForTimeout(500);
  await shot("a09-linha-do-tempo", [["tempo", dlg().locator("ol")]]);
  fs.writeFileSync(`${DIR}/caixas.json`, JSON.stringify(caixas, null, 1));
  await b.close();
})();
