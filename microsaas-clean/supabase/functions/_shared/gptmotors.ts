// GPT Motors — lógica de API compartilhada (function gpt-motors, asaas-webhook e whatsapp-webhook).
// Pura: recebe as credenciais e devolve o resultado normalizado. Não toca no banco.

export interface GptCfg { authUrl: string; chave: string; token: string }
export type GptProduto = "raiox" | "crlv" | "debitos" | "cnh";
export interface GptOut { ok: boolean; dados: any; analiseIA: string | null; controle: any; erro: string | null }

export const PRICE_COL: Record<GptProduto, string> = { raiox: "gpt_raiox_price", crlv: "gpt_crlv_price", debitos: "gpt_debitos_price", cnh: "gpt_cnh_price" };
export const CACHE_DAYS: Record<GptProduto, number> = { raiox: 7, crlv: 30, debitos: 0, cnh: 7 };
export const IS_CPF: Record<GptProduto, boolean> = { raiox: false, crlv: false, debitos: false, cnh: true }; // cnh consulta é por CPF
export const normPlaca = (p: unknown) => String(p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
export const normCpf = (c: unknown) => String(c ?? "").replace(/\D/g, "").slice(0, 11);

// A API do provedor às vezes responde em camelCase (dados/controle) e às vezes em PascalCase
// (Dados/Controle/Mensagem). Lê os dois. E NUNCA devolve pro usuário a mensagem técnica crua
// (stack/JSON do .NET) — vira um código curto que o app traduz.
const pick = (o: any, ...keys: string[]) => { if (!o) return undefined; for (const k of keys) if (o[k] != null) return o[k]; return undefined; };
function parseResp(j: any) {
  const controle = pick(j, "controle", "Controle");
  return {
    dados: pick(j, "dados", "Dados") ?? null,
    controle: controle ?? null,
    analiseIA: pick(j, "analiseIA", "AnaliseIA", "analiseIa") ?? null,
    sucesso: controle ? (pick(controle, "sucesso", "Sucesso") ?? true) : true,
    mensagem: controle ? pick(controle, "mensagem", "Mensagem") : undefined,
  };
}
function cleanErro(msg: unknown, fallback: string): string {
  const s = String(msg ?? "").trim();
  if (!s) return fallback;
  // não vaza JSON/stack/erro técnico pro usuário
  if (s.length > 120 || /[{}\[\]]|isFinalBlock|LineNumber|BytePosition|Exception|System\.|Json/i.test(s)) return fallback;
  return s;
}

// O provedor às vezes demora minutos (Detran fora do ar). Sem limite, o app desiste antes da resposta
// e mostra erro técnico. Limite de 50s por chamada → erro amigável "provedor_demorou".
export const UPSTREAM_TIMEOUT_MS = 50_000;
const isTimeout = (e: unknown) => /timeout|aborted|TimeoutError/i.test(String((e as any)?.name || "") + String((e as any)?.message || e));

async function gptAuth(cfg: GptCfg): Promise<string> {
  try {
    const r = await fetch(cfg.authUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ChaveAcesso: cfg.chave, TokenAcesso: cfg.token }), signal: AbortSignal.timeout(20_000) });
    const j = await r.json().catch(() => ({}));
    return j?.accessToken || "";
  } catch { return ""; }
}

export async function runGptMotors(cfg: GptCfg, produto: GptProduto, placa: string, uf?: string): Promise<GptOut> {
  if (!cfg.authUrl || !cfg.chave || !cfg.token) return { ok: false, dados: null, analiseIA: null, controle: null, erro: "integracao_nao_configurada" };
  const bearer = await gptAuth(cfg);
  if (!bearer) return { ok: false, dados: null, analiseIA: null, controle: null, erro: "auth_provedor_falhou" };
  let origin = "https://app.gptmotors.com.br";
  try { origin = new URL(cfg.authUrl).origin; } catch { /* */ }
  const call = async (path: string) => {
    const r = await fetch(`${origin}${path}`, { headers: { authorization: `Bearer ${bearer}`, accept: "application/json" }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    const j = await r.json().catch(() => ({}));
    return { httpOk: r.ok, j };
  };

  try {
    if (produto === "raiox") {
      const { httpOk, j } = await call(`/api/v1/analise/veicular/pro?placa=${placa}`);
      const p = parseResp(j);
      const ok = httpOk && p.sucesso && !!p.dados;
      return { ok, dados: p.dados, analiseIA: p.analiseIA, controle: p.controle, erro: ok ? null : cleanErro(p.mensagem, "consulta_sem_retorno") };
    }
    if (produto === "crlv") {
      const { httpOk, j } = await call(`/api/v1/documentacao/crlv?uf=${(uf || "").toUpperCase()}&placa=${placa}`);
      const p = parseResp(j);
      const ok = httpOk && p.sucesso && !!p.dados;
      return { ok, dados: p.dados, analiseIA: p.analiseIA, controle: p.controle, erro: ok ? null : cleanErro(p.mensagem, "crlv_indisponivel") };
    }
    if (produto === "cnh") {
      // aqui o parâmetro "placa" carrega o CPF (consulta de CNH é por CPF)
      const { httpOk, j } = await call(`/api/v1/documentacao/cnh?cpf=${placa}`);
      const p = parseResp(j);
      const ok = httpOk && p.sucesso && !!p.dados;
      return { ok, dados: p.dados, analiseIA: p.analiseIA, controle: p.controle, erro: ok ? null : cleanErro(p.mensagem, "cnh_indisponivel") };
    }
    // debitos = estadual + renainf
    const est = await call(`/api/v1/identificacao/estadual?placa=${placa}`);
    const ren = await call(`/api/v1/analise/risco/renainf?placa=${placa}`);
    const pe = parseResp(est.j), pr = parseResp(ren.j);
    const dados = { estadual: pe.dados, renainf: pr.dados };
    const ok = (est.httpOk || ren.httpOk) && (dados.estadual || dados.renainf);
    return { ok, dados, analiseIA: pe.analiseIA || pr.analiseIA, controle: pe.controle ?? pr.controle, erro: ok ? null : cleanErro(pe.mensagem || pr.mensagem, "debitos_indisponivel") };
  } catch (e) {
    return { ok: false, dados: null, analiseIA: null, controle: null, erro: isTimeout(e) ? "provedor_demorou" : cleanErro((e as any)?.message || e, "consulta_sem_retorno") };
  }
}

// Resumo curto pra mandar no WhatsApp
export function resumoGpt(produto: GptProduto, out: GptOut): string {
  if (!out.ok) return "";
  if (produto === "raiox") {
    const b = out.dados?.veiculoDadosBasicos || {};
    const nome = [b.marca, b.modelo].filter(Boolean).join(" ") || "veículo";
    const flag = (v: any, ruim: string, bom: string) => (v ? ruim : bom);
    const linhas = [
      `🔎 *Raio-X do carro* — ${nome}${b.anoModelo ? ` ${b.anoModelo}` : ""}`,
      flag(out.dados?.leilaoDados, "🚨 Passagem por leilão: verificar", "🟢 Leilão: nada consta"),
      flag(out.dados?.sinistroDados, "🚨 Indício de sinistro: verificar", "🟢 Sinistro: nada consta"),
      flag(out.dados?.rouboFurtoDados, "🚨 Roubo/furto: verificar", "🟢 Roubo/furto: nada consta"),
      flag(out.dados?.gravameDados, "⚠️ Gravame/financiamento: verificar", "🟢 Gravame: nada consta"),
    ];
    if (out.analiseIA) linhas.push("", out.analiseIA);
    return linhas.join("\n");
  }
  if (produto === "crlv") {
    const d = out.dados || {};
    return [`📄 *CRLV-e* — ${[d.marcaModelo, d.anoModelo].filter(Boolean).join(" · ") || d.placa || ""}`, "Documento emitido. Te mando o arquivo em seguida."].join("\n");
  }
  if (produto === "cnh") {
    const linhas = ["🪪 *Consulta CNH*"];
    if (out.analiseIA) linhas.push("", out.analiseIA);
    else linhas.push("Consulta concluída — veja pontos e situação no app.");
    return linhas.join("\n");
  }
  // debitos
  const est = out.dados?.estadual, ren = out.dados?.renainf;
  const debs: any[] = Array.isArray(est?.debitosEstaduais) ? est.debitosEstaduais : [];
  const linhas = ["💸 *Débitos & Multas*"];
  if (est?.restricoesImpedimentos?.situacaoVeiculo) linhas.push(`Situação: ${est.restricoesImpedimentos.situacaoVeiculo}`);
  if (debs.length) debs.slice(0, 10).forEach((d) => linhas.push(`• ${d.nome || d.chave || "Débito"}: ${d.valor || "—"}`));
  else linhas.push("🟢 Nenhum débito estadual encontrado");
  if (ren?.resumo) linhas.push(`Multas federais (Renainf): ${ren.resumo.quantidadeOcorrencias ?? ren.resumo.quantidadeOcorrenciasTotal ?? 0}${ren.resumo.alerta ? ` · ${ren.resumo.alerta}` : ""}`);
  if (out.analiseIA) linhas.push("", out.analiseIA);
  return linhas.join("\n");
}
