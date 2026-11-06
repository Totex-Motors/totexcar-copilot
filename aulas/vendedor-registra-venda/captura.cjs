// Capturas da aula "Como o vendedor registra a venda e faz a entrega" — TELA REAL do link do vendedor
// (/venda/:token) com DADOS DE DEMONSTRAÇÃO (API simulada; cliente, CPF, placa e etiqueta fictícios).
// Pré-requisito: build de demonstração servido em 127.0.0.1:4179 (ver LEIAME.md).
const pw = require("playwright");
const fs = require("fs");
const DIR = __dirname;
const hoje = new Date().toISOString().slice(0, 10);
const carros = [
  { id: "v1", desc: "Chevrolet Onix 2022", versao: "1.0 LT", cor: "prata", placa: "ABC1D23", preco: 72900, km: 48212, capa: null, preparacao: { data: hoje, km: 48212 }, os: null },
  { id: "v2", desc: "Hyundai HB20 2021", versao: "1.0 Vision", cor: "branco", placa: "BRA2E19", preco: 64900, km: 30110, capa: null, preparacao: null, os: null },
  { id: "v3", desc: "Chevrolet Tracker 2020", versao: "1.0 Turbo LT", cor: "cinza", placa: "FJK3C45", preco: 89900, km: 61500, capa: null, preparacao: null, os: { numero: 15, status: "recebida", oficina: "Pires Transmissão" } },
];
let vendas = [];
const info = () => ({ ok: true, loja: "Cardoso Veículos", vendedor: { nome: "Glauter" }, carros, aviso: null, vendas });
(async () => {
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.route("**/functions/v1/dealer-api", async (r) => {
    const q = JSON.parse(r.request().postData() || "{}");
    if (q.action === "venda_registrar") {
      vendas = [{ id: "j1", cliente: "João", carro: "Chevrolet Onix 2022 prata", data: hoje, etiqueta: q.tag_label, ativou: false }];
      return r.fulfill({ json: { ok: true, welcome_sent: true, tag: { label: q.tag_label }, revisado: true }, headers: { "access-control-allow-origin": "*" } });
    }
    await r.fulfill({ json: info(), headers: { "access-control-allow-origin": "*" } });
  });
  const caixas = {};
  const shot = async (n, alvos = [], full = false) => {
    await p.waitForTimeout(500); await p.screenshot({ path: `${DIR}/capturas/${n}.png`, fullPage: full });
    caixas[n] = {};
    for (const [nome, loc] of alvos) { const bb = await loc.first().boundingBox().catch(() => null); if (bb) caixas[n][nome] = bb; }
    console.log("ok", n);
  };
  const campo = (rotulo) => p.locator("div.space-y-1", { hasText: rotulo }).first().locator("input").first();
  await p.goto("http://127.0.0.1:4179/venda/" + "g".repeat(24)); await p.waitForTimeout(1500);
  await shot("v01-lista", [["revisado", p.getByText("🛠️ Revisado").first()], ["semrev", p.getByText("⚠️ Sem revisão registrada").first()], ["naoficina", p.getByText(/Na oficina Pires/).first()]]);
  await p.getByPlaceholder(/Busque/).fill("abc1d23");
  await shot("v02-busca-placa", [["busca", p.getByPlaceholder(/Busque/)], ["placa", p.locator("b", { hasText: "ABC1D23" })]]);
  await p.getByText("Chevrolet Onix 2022").first().click();
  await shot("v03-carro-escolhido", [["revisado", p.getByText(/Revisado em/)], ["placa", p.locator("b", { hasText: "ABC1D23" }).first()]]);
  await campo("Nome").fill("João Pereira");
  await campo("WhatsApp").fill("11 98765-4321");
  await campo("CPF").fill("529.982.247-24");
  await shot("v04-cpf-invalido", [["cpf", campo("CPF")], ["aviso", p.getByText("CPF inválido")]]);
  await campo("CPF").fill("529.982.247-25");
  await p.mouse.wheel(0, 380); await p.waitForTimeout(300);
  await campo("Etiqueta").fill("CV-0016");
  await campo("Km na entrega").fill("48230");
  await shot("v05-cliente-entrega", [["nome", campo("Nome")], ["whats", campo("WhatsApp")], ["cpf", campo("CPF")], ["etiqueta", campo("Etiqueta")], ["placa", campo("Placa")], ["km", campo("Km na entrega")], ["registrar", p.getByRole("button", { name: "Registrar venda" })]]);
  await p.getByRole("button", { name: "Registrar venda" }).click(); await p.waitForTimeout(900);
  await shot("v06-venda-registrada", [["boasvindas", p.getByText(/recebeu a mensagem de boas-vindas/)], ["etiqueta", p.getByText(/vinculada a este cliente/)], ["revisao", p.getByText(/Troca de óleo da preparação/)], ["entrega", p.getByText(/Agora, na entrega/)]]);
  await p.getByRole("button", { name: "Registrar outra venda" }).click(); await p.waitForTimeout(900);
  await p.mouse.wheel(0, 2000); await p.waitForTimeout(400);
  await shot("v07-minhas-vendas", [["status", p.getByText("Falta escanear")]]);
  vendas[0].ativou = true;
  await p.reload(); await p.waitForTimeout(1200); await p.mouse.wheel(0, 2000); await p.waitForTimeout(400);
  await shot("v08-ativou", [["status", p.getByText("Ativou")]]);
  fs.writeFileSync(`${DIR}/caixas.json`, JSON.stringify(caixas, null, 1));
  await b.close();
})();
