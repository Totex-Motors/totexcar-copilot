// Capturas da aula "Como a oficina registra o serviço" — TELA REAL do link da oficina (/parceiro/:token),
// com DADOS DE DEMONSTRAÇÃO (respostas da API simuladas; placa e fotos fictícias).
const pw = require("playwright");
const DIR = __dirname;
const agora = () => new Date().toISOString();
const os = {
  id: "os14", numero: 14, dealership: "Cardoso Veículos", oficina_id: "pires", vehicle_id: "v1", car_desc: "Onix 2022 prata", placa: "ABC1D23",
  servicos: ["troca_oleo"], status: "enviada", pedido_obs: null, enviada_por: "Lucas Silva", enviada_em: agora(), km_saida: 48200,
  recebida_em: null, km_chegada: null, concluida_em: null, km_servico: null, oleo_viscosidade: null, oleo_norma: null, oleo_marca: null, oleo_litros: null,
  filtro_oleo: null, filtro_ar: null, filtro_combustivel: null, filtro_cabine: null, servico_obs: null, valor: null,
  extra_descricao: null, extra_valor: null, extra_status: null, devolvida_em: null, km_volta: null, fotos: {}, km_ida: null, horas_na_oficina: 1, atrasada: false,
};
const info = () => ({ ok: true, oficina: { nome: "Pires Transmissão", responsavel: "Jackson", loja: "Cardoso Veículos" }, servicos: { troca_oleo: "troca de óleo e filtro", revisao: "revisão", outro: "outro serviço" }, ordens: [os] });
(async () => {
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.route("**/functions/v1/dealer-api", async (r) => {
    const q = JSON.parse(r.request().postData() || "{}");
    if (q.action === "parceiro_receber") Object.assign(os, { status: "recebida", recebida_em: agora(), km_chegada: q.km_chegada, km_ida: q.km_chegada - os.km_saida });
    if (q.action === "parceiro_concluir") Object.assign(os, { status: "concluida", concluida_em: agora(), km_servico: q.km_servico, oleo_viscosidade: q.oleo_viscosidade, oleo_norma: q.oleo_norma, oleo_marca: q.oleo_marca, oleo_litros: Number(String(q.oleo_litros).replace(",", ".")), filtro_oleo: q.filtro_oleo });
    await r.fulfill({ json: q.action === "parceiro_info" ? info() : { ok: true }, headers: { "access-control-allow-origin": "*" } });
  });
  const caixas = {};
  // alvos: [nome, locator] → caixa (px CSS) pra desenhar a marcação laranja no storyboard
  const shot = async (n, full = false, alvos = []) => {
    await p.waitForTimeout(500); await p.screenshot({ path: `${DIR}/capturas/${n}.png`, fullPage: full });
    caixas[n] = {};
    for (const [nome, loc] of alvos) { const bb = await loc.first().boundingBox().catch(() => null); if (bb) caixas[n][nome] = bb; }
    console.log("ok", n);
  };
  const dlg = () => p.locator('[role="dialog"]');
  const foto = async (rotulo, arq) => {
    const bloco = dlg().locator("div.space-y-1", { hasText: rotulo }).first();
    await bloco.locator('input[type="file"]').first().setInputFiles(`${DIR}/ilustracoes/${arq}`);
    await p.waitForTimeout(700);
  };
  await p.goto("http://127.0.0.1:4179/parceiro/" + "d".repeat(24)); await p.waitForTimeout(1500);
  await shot("c01-lista-chegando", false, [["chegando", p.getByText("Chegando (1)")], ["placa", p.locator("span", { hasText: /^ABC1D23$/ })], ["botao", p.getByRole("button", { name: /Recebi o carro/ })]]);
  await p.getByText("Recebi o carro").click(); await shot("c02-receber-vazio", false, [["placa", dlg().locator("div.border-2", { hasText: "CONFIRA A PLACA" })]]);
  await dlg().locator('input[type="number"]').fill("48210");
  await foto("Foto do painel", "painel.jpg");
  await shot("c03-receber-preenchido", false, [["km", dlg().locator("input[type=number]")], ["foto", dlg().locator("div.space-y-1", { hasText: "Foto do painel" }).locator("button").first()], ["confirmar", dlg().getByRole("button", { name: "Confirmar chegada" })]]);
  await dlg().getByRole("button", { name: "Confirmar chegada" }).click(); await p.waitForTimeout(900);
  await shot("c04a-chegada-confirmada");
  await p.waitForTimeout(5500);
  await shot("c04-lista-na-oficina", false, [["naoficina", p.getByText("Na oficina (1)")], ["registrar", p.getByRole("button", { name: /Registrar o serviço feito/ })], ["extra", p.getByRole("button", { name: /Encontrei algo além/ })]]);
  await p.getByText("Registrar o serviço feito").click(); await shot("c05-servico-vazio");
  const campo = (rotulo) => dlg().locator("div.space-y-1", { hasText: rotulo }).first().locator("input").first();
  await campo("Km do painel").fill("48212");
  await campo("Viscosidade").fill("5W30");
  await campo("Litros").fill("3,5");
  await campo("Norma").fill("API SP");
  await campo("Marca do óleo").fill("Lubrax");
  await shot("c06-servico-oleo", false, [["km", campo("Km do painel")], ["visc", campo("Viscosidade")], ["litros", campo("Litros")], ["norma", campo("Norma")], ["marca", campo("Marca do óleo")], ["filtro", dlg().getByText("Filtro de óleo")]]);
  await foto("Foto do painel", "painel.jpg");
  await dlg().evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await dlg().getByRole("button", { name: "Registrar serviço" }).click();
  await p.waitForTimeout(300); await shot("c07-erro-sem-etiqueta", false, [["aviso", p.getByText("Tire a foto da etiqueta de troca de óleo")], ["etiqueta", dlg().locator("div.space-y-1", { hasText: "Foto da etiqueta" }).locator("button").first()]]);
  await p.waitForTimeout(5500);
  await foto("Foto da etiqueta", "etiqueta.jpg");
  await dlg().evaluate((el) => el.scrollTo(0, 420)); await shot("c08-servico-fotos", false, [["painel", dlg().locator("div.space-y-1", { hasText: "Foto do painel" }).locator("button").first()], ["etiqueta", dlg().locator("div.space-y-1", { hasText: "Foto da etiqueta" }).locator("button").first()]]);
  await dlg().evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await dlg().getByRole("button", { name: "Registrar serviço" }).click(); await p.waitForTimeout(900);
  await shot("c09a-aviso-registrado", false, [["aviso", p.getByText("Serviço registrado")]]);
  await p.waitForTimeout(5500);
  await shot("c09-servico-registrado", false, [["feitos", p.getByText("Serviços feitos (1)")], ["resumo", p.getByText(/5W30 · API SP/)], ["status", p.getByText("Pronto p/ buscar")]]);
  require("fs").writeFileSync(`${DIR}/caixas.json`, JSON.stringify(caixas, null, 1));
  await b.close();
})();
