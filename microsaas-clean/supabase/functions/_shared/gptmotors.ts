// GPT Motors — lógica de API compartilhada (function gpt-motors, asaas-webhook e whatsapp-webhook).
// Pura: recebe as credenciais e devolve o resultado normalizado. Não toca no banco.

export interface GptCfg { authUrl: string; chave: string; token: string }
export type GptProduto = "raiox" | "crlv" | "debitos";
export interface GptOut { ok: boolean; dados: any; analiseIA: string | null; controle: any; erro: string | null }

export const PRICE_COL: Record<GptProduto, string> = { raiox: "gpt_raiox_price", crlv: "gpt_crlv_price", debitos: "gpt_debitos_price" };
export const CACHE_DAYS: Record<GptProduto, number> = { raiox: 7, crlv: 30, debitos: 0 };
export const normPlaca = (p: unknown) => String(p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);

async function gptAuth(cfg: GptCfg): Promise<string> {
  try {
    const r = await fetch(cfg.authUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ChaveAcesso: cfg.chave, TokenAcesso: cfg.token }) });
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
    const r = await fetch(`${origin}${path}`, { headers: { authorization: `Bearer ${bearer}`, accept: "application/json" } });
    const j = await r.json().catch(() => ({}));
    return { httpOk: r.ok, j };
  };

  try {
    if (produto === "raiox") {
      const { httpOk, j } = await call(`/api/v1/analise/veicular/pro?placa=${placa}`);
      const ok = httpOk && (j?.controle?.sucesso ?? true) && !!j?.dados;
      return { ok, dados: j?.dados ?? null, analiseIA: j?.analiseIA ?? null, controle: j?.controle ?? null, erro: ok ? null : (j?.controle?.mensagem || "consulta_sem_retorno") };
    }
    if (produto === "crlv") {
      const { httpOk, j } = await call(`/api/v1/documentacao/crlv?uf=${(uf || "").toUpperCase()}&placa=${placa}`);
      const ok = httpOk && (j?.controle?.sucesso ?? true) && !!j?.dados;
      return { ok, dados: j?.dados ?? null, analiseIA: j?.analiseIA ?? null, controle: j?.controle ?? null, erro: ok ? null : (j?.controle?.mensagem || "crlv_indisponivel") };
    }
    // debitos = estadual + renainf
    const est = await call(`/api/v1/identificacao/estadual?placa=${placa}`);
    const ren = await call(`/api/v1/analise/risco/renainf?placa=${placa}`);
    const dados = { estadual: est.j?.dados ?? null, renainf: ren.j?.dados ?? null };
    const ok = (est.httpOk || ren.httpOk) && (dados.estadual || dados.renainf);
    return { ok, dados, analiseIA: est.j?.analiseIA || ren.j?.analiseIA || null, controle: est.j?.controle ?? ren.j?.controle ?? null, erro: ok ? null : (est.j?.controle?.mensagem || ren.j?.controle?.mensagem || "debitos_indisponivel") };
  } catch (e) {
    return { ok: false, dados: null, analiseIA: null, controle: null, erro: String((e as any)?.message || e) };
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
