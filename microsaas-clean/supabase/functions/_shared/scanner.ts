// LAUDO DO SCANNER (Doutor-IE Connect) — lê o relatório em PDF que o app exporta ("Checklist de entrada"),
// guarda o arquivo e os dados no carro (pela placa) e compara o ANTES (entrada) com o DEPOIS (conferência,
// feita depois do reparo na oficina). A leitura é por regras em cima do texto do PDF (sem IA): o que não
// der pra ler com certeza fica como "ver o PDF", nunca como "sem falhas".
// (A extração do texto do PDF fica em scanner-pdf.ts: só o painel carrega a biblioteca de PDF; o webhook não.)

export const BUCKET = "arquivozap";
export const MAX_PDF = 15_000_000;
export type Falha = { codigo: string; descricao: string | null };
export type Bateria = { status: "aprovada" | "reprovada" | null; inicial: number | null; minima: number | null; maxima: number | null; queda: number | null; temperatura: number | null };
export type LaudoLido = {
  reconhecido: boolean; titulo: string | null; gerado_em: string | null; placa: string | null; km: number | null; car_desc: string | null;
  n_falhas: number | null; falhas: Falha[]; bateria: Bateria | null; compressao: string | null;
};

export const limpaPlaca = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const PLACA_OK = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
const numero = (s?: string | null) => { const t = String(s ?? "").trim().replace(",", "."); const n = Number(t); return t && Number.isFinite(n) ? n : null; };
export const lojaSlug = (loja: string) => String(loja || "loja").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "loja";

// "24/11/2026 16:29:01" (horário de Brasília) → ISO
function dataHoraBR(s?: string | null): string | null {
  const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4] || "12"}:${m[5] || "00"}:${m[6] || "00"}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function lerLaudo(paginas: string[]): LaudoLido {
  const tudo = paginas.join("\n");
  const campo = (rot: string) => (tudo.match(new RegExp(`${rot}\\s*:\\s*([^\\n]+)`, "i"))?.[1] || "").trim() || null;
  const placaLida = limpaPlaca(campo("Placa"));
  const kmTxt = tudo.match(/Quilometragem\s*:\s*([\d.\s]+)\s*km/i)?.[1] || "";
  const km = Number(kmTxt.replace(/\D/g, "")) || null;
  const veiculo = campo("Ve[ií]culo\\/ano"), montadora = campo("Montadora"), motor = campo("Motor"), cor = campo("Cor");
  const car_desc = [montadora, veiculo?.replace(/\s*-\s*/, " "), motor, cor].filter(Boolean).join(" ").slice(0, 120) || null;

  // ---- códigos de falha: a seção vai do título até o teste de bateria
  const iniF = tudo.search(/C[óo]digos?\s+de\s+falha/i);
  let n_falhas: number | null = null;
  let falhas: Falha[] = [];
  if (iniF >= 0) {
    const resto = tudo.slice(iniF);
    const fim = resto.slice(20).search(/B\s*a\s*t\s*e\s*r\s*i\s*a\s+(a\s*p\s*r\s*o\s*v|r\s*e\s*p\s*r\s*o\s*v)|Tens[ãa]o\s+inicial|Compress[ãa]o\s+relativa/i);
    const secao = (fim >= 0 ? resto.slice(0, fim + 20) : resto).replace(/\b\d{2}\/\d{2}\b(?=\s*$|\s*\n)/gm, "");
    if (/nenhuma\s+falha/i.test(secao)) n_falhas = 0;
    else {
      const re = /\b([PCBU][0-9A-F]{4}(?:-[0-9A-F]{2})?)\b/g;
      const achados: { codigo: string; i: number; fim: number }[] = [];
      for (let m = re.exec(secao); m; m = re.exec(secao)) achados.push({ codigo: m[1], i: m.index, fim: m.index + m[0].length });
      const vistos = new Set<string>();
      achados.forEach((a, k) => {
        if (vistos.has(a.codigo)) return;
        vistos.add(a.codigo);
        const desc = secao.slice(a.fim, achados[k + 1]?.i ?? a.fim + 220).replace(/\s+/g, " ").replace(/^[\s:·\-–|]+/, "").trim().slice(0, 180);
        falhas.push({ codigo: a.codigo, descricao: desc || null });
      });
      n_falhas = falhas.length || null; // seção sem "nenhuma falha" e sem código legível: não afirma nada
    }
  }
  falhas = falhas.slice(0, 40);

  // ---- bateria (o título vem com letras espaçadas: "B a t e r i a a p r o v a d a")
  const junto = tudo.replace(/[ \t]+/g, "");
  const st = junto.match(/Bateria(aprovada|reprovada)/i)?.[1]?.toLowerCase() as "aprovada" | "reprovada" | undefined;
  const volt = (rot: string) => numero(tudo.match(new RegExp(`${rot}\\s*:\\s*\\n?\\s*([\\d.,]+)\\s*V`, "i"))?.[1]);
  const temp = numero(tudo.match(/arrefecimento\s*:\s*\n?\s*([\d.,]+)\s*º?\s*°?\s*C/i)?.[1]) ?? numero(tudo.match(/Temperatura\s+do\s+motor\s*:\s*([\d.,]+)/i)?.[1]);
  const inicial = volt("Tens[ãa]o\\s+inicial");
  const bateria: Bateria | null = st || inicial != null
    ? { status: st || null, inicial, minima: volt("Tens[ãa]o\\s+m[ií]nima"), maxima: volt("Tens[ãa]o\\s+m[áa]xima"), queda: volt("Queda\\s+de\\s+tens[ãa]o"), temperatura: temp }
    : null;

  // ---- compressão relativa: a linha depois de "Resultado"
  const comp = tudo.match(/Compress[ãa]o\s+relativa\s*\n\s*Resultado\s*\n\s*([^\n]+)/i)?.[1]?.replace(/\d{2}\/\d{2}.*$/, "").trim() || null;

  const titulo = (paginas[0] || "").split("\n").map((l) => l.trim()).find(Boolean)?.slice(0, 80) || null;
  return {
    reconhecido: iniF >= 0 || !!bateria || PLACA_OK.test(placaLida),
    titulo, gerado_em: dataHoraBR(tudo.match(/Gerado\s+em\s*:\s*([^\n]+)/i)?.[1]),
    placa: PLACA_OK.test(placaLida) ? placaLida : null, km: km && km > 0 && km < 2_000_000 ? km : null, car_desc,
    n_falhas, falhas, bateria, compressao: comp ? comp.slice(0, 160) : null,
  };
}

// caminho novo pro upload direto do navegador (URL assinada): scanner/<loja>/<uuid>.pdf
export async function novoUpload(sb: any, loja: string): Promise<{ path: string; token: string } | null> {
  const path = `scanner/${lojaSlug(loja)}/${crypto.randomUUID()}.pdf`;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  return error || !data?.token ? null : { path, token: data.token };
}
export const caminhoDaLoja = (loja: string, path: unknown) => new RegExp(`^scanner/${lojaSlug(loja)}/[0-9a-f-]{36}\\.pdf$`).test(String(path || ""));

// laudo mais recente do carro (pela placa), dentro de N dias
export async function ultimoLaudo(sb: any, loja: string, placa: unknown, dias = 120, momento?: string): Promise<any | null> {
  const p = limpaPlaca(placa);
  if (!PLACA_OK.test(p) || !loja) return null;
  try {
    let q = sb.from("scanner_laudos").select("*").eq("dealership", loja).eq("placa", p).gte("created_at", new Date(Date.now() - dias * 86_400_000).toISOString());
    if (momento) q = q.eq("momento", momento);
    const { data } = await q.order("created_at", { ascending: false }).limit(1);
    return data?.[0] || null;
  } catch { return null; }
}

// ANTES x DEPOIS: o que a oficina resolveu, o que continua e o que apareceu de novo
export function compararLaudos(antes: any, depois: any): { resolvidas: string[]; continuam: string[]; novas: string[] } | null {
  if (!antes || !depois || antes.n_falhas == null || depois.n_falhas == null) return null;
  const a = new Set<string>((antes.falhas || []).map((f: Falha) => f.codigo)), d = new Set<string>((depois.falhas || []).map((f: Falha) => f.codigo));
  return { resolvidas: [...a].filter((c) => !d.has(c)), continuam: [...a].filter((c) => d.has(c)), novas: [...d].filter((c) => !a.has(c)) };
}

const dataBR = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const volts = (n: number | null | undefined) => (n != null ? `${String(n).replace(".", ",")} V` : "");
export const codigos = (l: any, max = 8) => (l?.falhas || []).slice(0, max).map((f: Falha) => f.codigo).join(", ") + ((l?.falhas || []).length > max ? "…" : "");
export function textoFalhas(l: any): string {
  if (l?.n_falhas === 0) return "nenhuma falha encontrada";
  if (l?.n_falhas == null) return "lista de falhas no PDF";
  return `${l.n_falhas} falha${l.n_falhas === 1 ? "" : "s"} (${codigos(l)})`;
}
// 1 linha: "nenhuma falha encontrada · bateria aprovada (12,6 V) · 31.289 km · 24/11/2026"
export function resumoLaudo(l: any): string {
  const b = l?.bateria as Bateria | null;
  return [
    textoFalhas(l),
    b?.status ? `bateria ${b.status}${b.inicial != null ? ` (${volts(b.inicial)})` : ""}` : null,
    l?.km ? `${Number(l.km).toLocaleString("pt-BR")} km` : null,
    dataBR(l?.gerado_em || l?.created_at) || null,
  ].filter(Boolean).join(" · ");
}

// URL assinada do PDF (padrão 1 h; pro cliente na entrega, 7 dias)
export async function linkLaudo(sb: any, l: any, segundos = 3600): Promise<string | null> {
  if (!l?.arquivo) return null;
  try { return (await sb.storage.from(BUCKET).createSignedUrl(l.arquivo, segundos)).data?.signedUrl || null; } catch { return null; }
}
const paraTela = (l: any, url: string | null) => l ? {
  id: l.id, momento: l.momento, placa: l.placa, car_desc: l.car_desc, gerado_em: l.gerado_em || l.created_at, km: l.km, n_falhas: l.n_falhas, falhas: l.falhas || [],
  bateria: l.bateria || null, compressao: l.compressao || null, enviado_por: l.enviado_por || null, os_id: l.os_id || null, resumo: resumoLaudo(l), url,
} : null;
export async function laudoParaTela(sb: any, l: any): Promise<any | null> { return paraTela(l, await linkLaudo(sb, l)); }

// Ordens de serviço com o scanner de entrada, o de conferência e a comparação
export async function comScanner(sb: any, ordens: any[]): Promise<any[]> {
  const ids = [...new Set(ordens.flatMap((o) => [o.scanner_entrada_id, o.scanner_saida_id]).filter(Boolean))] as string[];
  if (!ids.length) return ordens.map((o) => ({ ...o, scanner_entrada: null, scanner_saida: null, scanner_comparacao: null }));
  let laudos: any[] = [];
  try { laudos = (await sb.from("scanner_laudos").select("*").in("id", ids)).data || []; } catch { /* tabela ausente */ }
  const url: Record<string, string> = {};
  const paths = laudos.map((l) => l.arquivo).filter(Boolean);
  if (paths.length) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
    for (const d of data || []) if (d?.path && d?.signedUrl) url[d.path] = d.signedUrl;
  }
  const por: Record<string, any> = Object.fromEntries(laudos.map((l) => [l.id, l]));
  return ordens.map((o) => {
    const e = por[o.scanner_entrada_id] || null, s = por[o.scanner_saida_id] || null;
    return { ...o, scanner_entrada: paraTela(e, e ? url[e.arquivo] || null : null), scanner_saida: paraTela(s, s ? url[s.arquivo] || null : null), scanner_comparacao: compararLaudos(e, s) };
  });
}
export async function listarLaudos(sb: any, loja: string, limite = 60): Promise<any[]> {
  const { data, error } = await sb.from("scanner_laudos").select("*").eq("dealership", loja).order("created_at", { ascending: false }).limit(limite);
  if (error) throw new Error(/relation|does not exist/i.test(error.message) ? "rode_o_sql_do_scanner" : error.message);
  const url: Record<string, string> = {};
  const paths = (data || []).map((l: any) => l.arquivo).filter(Boolean);
  if (paths.length) {
    const r = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
    for (const d of r.data || []) if (d?.path && d?.signedUrl) url[d.path] = d.signedUrl;
  }
  return (data || []).map((l: any) => paraTela(l, url[l.arquivo] || null));
}
// texto da comparação pros avisos do grupo
export function textoComparacao(c: ReturnType<typeof compararLaudos>): string {
  if (!c) return "";
  const p: string[] = [];
  if (c.resolvidas.length) p.push(`✅ resolvidas: ${c.resolvidas.join(", ")}`);
  if (c.continuam.length) p.push(`⚠️ CONTINUAM: ${c.continuam.join(", ")}`);
  if (c.novas.length) p.push(`🆕 novas: ${c.novas.join(", ")}`);
  return p.join(" · ") || "sem falhas antes e depois";
}
