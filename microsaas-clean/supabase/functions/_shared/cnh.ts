// CNH importada da CNH digital (PDF exportado do app do governo) ou foto da CNH física.
// O gov.br não libera a CNH pra app privado: o cliente exporta o PDF e manda — a IA lê os campos,
// o original fica no ArquivoZap (pasta privada) e a validade alimenta os avisos de renovação.
// Pontos e situação NÃO vêm no documento: continuam na consulta paga do Detran.

import type { AIConfig } from "./proactive.ts";

export type CnhLida = {
  e_cnh: boolean;
  nome: string | null;
  categoria: string | null;
  numero_registro: string | null;
  validade: string | null;              // YYYY-MM-DD
  primeira_habilitacao: string | null;  // YYYY-MM-DD
  emissao: string | null;               // YYYY-MM-DD
  observacoes: string | null;           // ex.: "EAR", "A" (lentes)
  digital: boolean;                     // veio do PDF da CNH digital (QR code / assinatura)
};

export type Midia = { data: string; mime: string };

const PROMPT = `Você lê documentos brasileiros. Analise o arquivo e diga se é uma CNH (Carteira Nacional de Habilitação), física ou digital (CNH-e exportada do app Carteira Digital de Trânsito / CNH do Brasil).
Responda SÓ um JSON, sem texto fora dele:
{"e_cnh": true|false, "nome": "nome completo", "categoria": "AB", "numero_registro": "só dígitos", "validade": "DD/MM/AAAA", "primeira_habilitacao": "DD/MM/AAAA", "emissao": "DD/MM/AAAA", "observacoes": "campo observações, ex.: EAR", "digital": true|false}
Regras: copie EXATAMENTE o que está escrito; campo ilegível ou ausente = null (nunca invente). "digital" = true se for o PDF/print da CNH digital (tem QR code e assinatura digital). Se não for CNH, {"e_cnh": false}.`;

// "12/03/2031" ou "2031-03-12" → "2031-03-12" (data impossível → null)
export function dataIso(v: unknown): string | null {
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/);
  let y: number, mo: number, d: number;
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1940 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const txt = (v: unknown, max = 80) => { const s = String(v ?? "").trim(); return s && s.toLowerCase() !== "null" ? s.slice(0, max) : null; };

export function normalizarCnh(raw: any): CnhLida {
  const cat = String(raw?.categoria ?? "").toUpperCase().replace(/[^A-E]/g, "").slice(0, 5);
  const reg = String(raw?.numero_registro ?? "").replace(/\D/g, "");
  return {
    e_cnh: raw?.e_cnh === true,
    nome: txt(raw?.nome, 120),
    categoria: cat || null,
    numero_registro: reg.length >= 9 && reg.length <= 12 ? reg : null,
    validade: dataIso(raw?.validade),
    primeira_habilitacao: dataIso(raw?.primeira_habilitacao),
    emissao: dataIso(raw?.emissao),
    observacoes: txt(raw?.observacoes, 60),
    digital: raw?.digital === true,
  };
}

// Uma chamada de visão (PDF ou imagem) no provedor configurado no admin. Falha → null.
export async function lerCnhMidia(cfg: AIConfig, m: Midia): Promise<CnhLida | null> {
  if (!cfg?.key) return null;
  const pdf = m.mime === "application/pdf";
  try {
    let text = "";
    if (cfg.provider === "openai") {
      const arq = pdf
        ? { type: "file", file: { filename: "cnh.pdf", file_data: `data:application/pdf;base64,${m.data}` } }
        : { type: "image_url", image_url: { url: `data:${m.mime};base64,${m.data}` } };
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({ model: cfg.model, max_tokens: 500, temperature: 0, response_format: { type: "json_object" },
          messages: [{ role: "user", content: [arq, { type: "text", text: PROMPT }] }] }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
      text = (await res.json()).choices?.[0]?.message?.content || "";
    } else if (cfg.provider === "gemini") {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ inline_data: { mime_type: m.mime, data: m.data } }, { text: PROMPT }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 500, responseMimeType: "application/json" } }),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
      text = ((await res.json()).candidates?.[0]?.content?.parts || []).map((p: any) => p.text).filter(Boolean).join("");
    } else {
      const arq = pdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: m.data } }
        : { type: "image", source: { type: "base64", media_type: m.mime, data: m.data } };
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: cfg.model, max_tokens: 500, messages: [{ role: "user", content: [arq, { type: "text", text: PROMPT }] }] }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
      text = ((await res.json()).content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    }
    const json = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const ini = json.indexOf("{"), fim = json.lastIndexOf("}");
    return normalizarCnh(JSON.parse(ini >= 0 && fim > ini ? json.slice(ini, fim + 1) : json));
  } catch (e) {
    console.error("lerCnhMidia:", e);
    return null;
  }
}

const br = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

// Ficha do ArquivoZap pra CNH lida
export function fichaCnh(c: CnhLida) {
  return {
    tipo: "cnh",
    nome: `CNH${c.categoria ? ` · categoria ${c.categoria}` : ""}`,
    resumo: [c.validade && `Validade ${br(c.validade)}`, c.categoria && `Cat. ${c.categoria}`, c.digital ? "CNH digital" : null].filter(Boolean).join(" · ") || "CNH",
  };
}

// Leva a CNH lida pro cadastro (vencimento → avisos de renovação já existentes)
export async function aplicarCnhNoCadastro(sb: any, userId: string, c: CnhLida): Promise<void> {
  const up: Record<string, string> = {};
  if (c.validade) up.cnh_vencimento = c.validade;
  if (c.categoria) up.cnh_categoria = c.categoria;
  if (c.numero_registro) up.cnh_numero = c.numero_registro;
  if (Object.keys(up).length) await sb.from("users").update(up).eq("id", userId);
}
