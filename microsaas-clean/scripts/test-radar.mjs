#!/usr/bin/env node
// Testes de aceitação do RADAR DE SERVIÇOS (TESTES-DE-ACEITACAO.md).
//
// Cobre o que é DETERMINÍSTICO: classificação de serviço, deduplicação,
// ranking, honestidade dos campos e o portão de consentimento.
// O que depende de conversa (a IA fazer as perguntas de segurança antes de
// preço, por exemplo) está no prompt do agente e se valida em teste real —
// está listado no fim como "não coberto aqui", de propósito.
//
// Rodar:  node scripts/test-radar.mjs
// Sem dependência nova: usa o esbuild que já vem com o Vite.

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SRC = resolve("supabase/functions/_shared/radar-search.ts");
const dir = mkdtempSync(join(tmpdir(), "radar-test-"));
const out = join(dir, "radar-search.mjs");

execFileSync("npx", ["esbuild", SRC, "--format=esm", `--outfile=${out}`], {
  stdio: ["ignore", "ignore", "inherit"],
  shell: process.platform === "win32",
});

const R = await import(pathToFileURL(out).href);

// ---------------------------------------------------------------- runner
let passou = 0;
const falhas = [];
const t = (nome, fn) => {
  try { fn(); passou++; console.log(`  \x1b[32m✓\x1b[0m ${nome}`); }
  catch (e) { falhas.push([nome, e.message]); console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      ${e.message}`); }
};
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m || `esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || "condição falsa"); };

const prov = (o) => ({
  name: "X", source: "web_search", phone: null, whatsapp: null, website: null,
  address: null, city: null, state: null, latitude: null, longitude: null,
  rating: null, review_count: null, open_now: null, open_24h: null,
  mobile_service: null, supports_ev: null, supports_hybrid: null,
  external_id: null, distance_km: null, ...o,
});

// ============================================================ 1 e 2
console.log("\n\x1b[1m1/2. Detecção do serviço\x1b[0m");

t("'bateria' → bateria (teste 1: trocar a bateria do Corolla)", () => {
  eq(R.normalizeServiceType("bateria"), "bateria");
});
t("alias em inglês 'battery' → bateria", () => {
  eq(R.normalizeServiceType("battery"), "bateria");
});
t("'pneu'/'pneus'/'tire' → pneus (teste 2: trocar dois pneus)", () => {
  eq(R.normalizeServiceType("pneu"), "pneus");
  eq(R.normalizeServiceType("pneus"), "pneus");
  eq(R.normalizeServiceType("tire"), "pneus");
});
t("vazio → oficina (padrão seguro, nunca undefined)", () => {
  eq(R.normalizeServiceType(""), "oficina");
  eq(R.normalizeServiceType(null), "oficina");
});
t("categoria desconhecida cai em oficina, não quebra", () => {
  eq(R.normalizeServiceType("coisa que nao existe"), "oficina");
});

// ============================================================ 3 e 4
console.log("\n\x1b[1m3/4. Urgência e emergência\x1b[0m");

t("guincho/borracharia/chaveiro/socorro são emergência (teste 4: pneu rasgou)", () => {
  ok(R.isEmergencyService("guincho"), "guincho deveria ser emergência");
  ok(R.isEmergencyService("borracharia"), "borracharia deveria ser emergência");
  ok(R.isEmergencyService("chaveiro"), "chaveiro deveria ser emergência");
  ok(R.isEmergencyService("socorro"), "socorro deveria ser emergência");
});
t("estética/vistoria NÃO são emergência", () => {
  ok(!R.isEmergencyService("estetica"));
  ok(!R.isEmergencyService("vistoria"));
});
t("em emergência, quem vai até você sobe no ranking", () => {
  const r = R.rankProviders(
    [prov({ name: "Fixa", mobile_service: null }), prov({ name: "Movel", mobile_service: true })],
    { emergency: true },
  );
  eq(r[0].name, "Movel", "o atendimento móvel deveria vir primeiro na emergência");
  ok(r[0].matched_reasons.includes("Vai até você"));
});

// ============================================================ dedup
console.log("\n\x1b[1mDeduplicação (nunca repetir o mesmo estabelecimento)\x1b[0m");

t("mesmo telefone em fontes diferentes = 1 resultado", () => {
  const r = R.dedupProviders([
    prov({ name: "Auto Center A", phone: "11988887777", source: "web_search" }),
    prov({ name: "Auto Center A - Matriz", phone: "(11) 98888-7777", source: "google_places" }),
  ]);
  eq(r.length, 1);
});
t("mesmo domínio = 1 resultado", () => {
  const r = R.dedupProviders([
    prov({ name: "Oficina B", website: "https://www.oficinab.com.br/contato" }),
    prov({ name: "Oficina B Filial", website: "http://oficinab.com.br" }),
  ]);
  eq(r.length, 1);
});
t("mesmo id da fonte = 1 resultado", () => {
  const r = R.dedupProviders([
    prov({ name: "C", external_id: "places/123", source: "google_places" }),
    prov({ name: "C outro nome", external_id: "places/123", source: "google_places" }),
  ]);
  eq(r.length, 1);
});
t("mesmo nome a <250m = 1 resultado (e funde os dados)", () => {
  const r = R.dedupProviders([
    prov({ name: "Pneus Silva", latitude: -23.5100, longitude: -46.8700, phone: null }),
    prov({ name: "PNEUS SILVA", latitude: -23.5101, longitude: -46.8701, phone: "11955554444" }),
  ]);
  eq(r.length, 1);
  eq(r[0].phone, "11955554444", "deveria ter aproveitado o telefone do duplicado");
});
t("nomes iguais LONGE um do outro = 2 resultados (filiais reais)", () => {
  const r = R.dedupProviders([
    prov({ name: "Rede Pneus", latitude: -23.51, longitude: -46.87 }),
    prov({ name: "Rede Pneus", latitude: -23.60, longitude: -46.60 }),
  ]);
  eq(r.length, 2);
});
t("nome com menos de 3 letras é descartado (lixo do parser)", () => {
  eq(R.dedupProviders([prov({ name: "A" })]).length, 0);
});

// ============================================================ ranking
console.log("\n\x1b[1mRanking (pesos do contrato)\x1b[0m");

t("mais perto ganha quando o resto é igual", () => {
  const r = R.rankProviders([prov({ name: "Longe", distance_km: 14 }), prov({ name: "Perto", distance_km: 1 })], { radiusKm: 15 });
  eq(r[0].name, "Perto");
  eq(r[0].rank_position, 1);
});
t("melhor avaliado ganha quando a distância é igual", () => {
  const r = R.rankProviders([
    prov({ name: "Ruim", rating: 3.0, review_count: 50, distance_km: 5 }),
    prov({ name: "Bom", rating: 4.8, review_count: 50, distance_km: 5 }),
  ], { radiusKm: 15 });
  eq(r[0].name, "Bom");
});
t("modo 'nearest' respeita o pedido do motorista", () => {
  const r = R.rankProviders([
    prov({ name: "Estrela", rating: 5.0, review_count: 900, distance_km: 12 }),
    prov({ name: "Vizinho", rating: 3.6, review_count: 10, distance_km: 0.5 }),
  ], { mode: "nearest", radiusKm: 15 });
  eq(r[0].name, "Vizinho");
});
t("carro elétrico prioriza quem atende elétrico", () => {
  const r = R.rankProviders([
    prov({ name: "Comum", supports_ev: false, distance_km: 2 }),
    prov({ name: "EV", supports_ev: true, distance_km: 6 }),
  ], { isEv: true, radiusKm: 15 });
  eq(r[0].name, "EV");
  ok(r[0].matched_reasons.includes("Atende elétrico/híbrido"));
});
t("rank_position é sequencial a partir de 1", () => {
  const r = R.rankProviders([prov({ name: "A" }), prov({ name: "B" }), prov({ name: "C" })], {});
  eq(r.map((x) => x.rank_position), [1, 2, 3]);
});

// ============================================================ teste 6
console.log("\n\x1b[1m6. Parceiro Totex (selo, não privilégio)\x1b[0m");

t("parceiro recebe o selo parceiro_totex", () => {
  const r = R.rankProviders([prov({ name: "PG Motors" })], { partnerNames: ["PG Motors"] });
  eq(r[0].provider_status, "parceiro_totex");
});
t("resultado público continua aparecendo junto do parceiro", () => {
  const r = R.rankProviders(
    [prov({ name: "PG Motors" }), prov({ name: "Oficina do Zé" })],
    { partnerNames: ["PG Motors"] },
  );
  eq(r.length, 2, "nenhum resultado público pode ser escondido");
  ok(r.some((x) => x.provider_status === "publico"));
});
t("no modo padrão, ser parceiro NÃO compra posição", () => {
  // parceiro ruim e longe vs público ótimo e perto: o público tem que ganhar
  const r = R.rankProviders([
    prov({ name: "Parceiro Fraco", rating: 3.0, review_count: 5, distance_km: 14 }),
    prov({ name: "Publico Forte", rating: 4.9, review_count: 800, distance_km: 1 }),
  ], { partnerNames: ["Parceiro Fraco"], radiusKm: 15 });
  eq(r[0].name, "Publico Forte", "parceiro não pode furar a fila do ranking padrão");
});

// ============================================================ teste 9
console.log("\n\x1b[1m9. Nunca inventar informação\x1b[0m");

t("campo ausente continua null (não vira 0, '' ou 'sim')", () => {
  const r = R.rankProviders([prov({ name: "Sem dados" })], {});
  eq(r[0].rating, null);
  eq(r[0].review_count, null);
  eq(r[0].open_24h, null);
  eq(r[0].mobile_service, null);
  eq(r[0].phone, null);
});
t("sem nota, não inventa motivo de recomendação", () => {
  const r = R.rankProviders([prov({ name: "Sem nota" })], {});
  ok(!r[0].matched_reasons.some((m) => /nota/i.test(m)), `motivos indevidos: ${r[0].matched_reasons}`);
});
t("não existe campo de preço/ETA/garantia no formato", () => {
  const r = R.rankProviders([prov({ name: "X" })], {});
  for (const proibido of ["price", "preco", "eta", "garantia", "warranty"]) {
    ok(!(proibido in r[0]), `campo proibido presente: ${proibido}`);
  }
});
t("open_now=false NÃO vira 'aberto agora'", () => {
  const r = R.rankProviders([prov({ name: "Fechado", open_now: false })], {});
  ok(!r[0].matched_reasons.includes("Aberto agora"));
});

// ============================================================ utilitários
console.log("\n\x1b[1mNormalizações\x1b[0m");

t("telefone: tira máscara e DDI 55", () => {
  eq(R.normalizePhone("+55 (11) 98888-7777"), "11988887777");
  eq(R.normalizePhone("(11) 3333-4444"), "1133334444");
});
t("telefone curto/vazio → null (não inventa número)", () => {
  eq(R.normalizePhone("123"), null);
  eq(R.normalizePhone(null), null);
  eq(R.normalizePhone(""), null);
});
t("domínio ignora www e caminho", () => {
  eq(R.extractDomain("https://www.Oficina.com.br/x?y=1"), "oficina.com.br");
  eq(R.extractDomain("lixo que nao e url"), null);
});
t("nome normalizado ignora acento, caixa e sufixo societário", () => {
  eq(R.normalizeName("Auto Center São João LTDA"), "auto center sao joao");
});
t("haversine bate com a distância real (~8,5 km em Alphaville)", () => {
  const d = R.haversineKm(-23.5100, -46.8700, -23.5505, -46.8300);
  ok(d > 5 && d < 8, `distância fora do esperado: ${d} km`);
});

// ============================================================ resumo
rmSync(dir, { recursive: true, force: true });

console.log(`\n\x1b[1m${passou} passaram, ${falhas.length} falharam\x1b[0m`);
if (falhas.length) {
  console.log("\nFalhas:");
  for (const [n, m] of falhas) console.log(`  - ${n}: ${m}`);
}
console.log(`
NÃO coberto por este arquivo (é comportamento de conversa, valida-se em teste real):
  · teste 3 — a IA perguntar sobre freio antes de concluir
  · teste 4 — triagem de segurança na via antes de falar de preço
  · teste 5 — o texto do aviso de resultado público (está no edge/prompt)
  · teste 7 — listar os dados antes de pedir orçamento
  · teste 8 — "pesquisa, mas não passa meu telefone"
  · teste 10 — ampliação do raio (depende de busca ao vivo)
O portão de consentimento do orçamento é validado no banco (CHECK quote_requires_consent)
e no edge/agente, que recusam sem consent_text + shared_fields.`);

process.exit(falhas.length ? 1 : 0);
