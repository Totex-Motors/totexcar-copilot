// TENDÊNCIA DA FIPE: a partir do histórico mensal (public.fipe_historico) diz se o carro valorizou,
// está estável ou em queda, e quantos meses SEGUIDOS caiu. Usado pela quanto-vale (card do app),
// pelo agente do WhatsApp (tool valor_do_carro) e pelo alerta mensal (car-expiration-alerts).
//
// Regra combinada com o dono: 1 queda = "atenção, está em queda"; 2+ quedas seguidas = sinal de
// tendência de desvalorização → alerta pra avaliar a troca. A FIPE é referência de mercado, não
// garantia de que vai continuar caindo — o texto nunca promete o futuro.

export type MesFipe = { ref: number; valor: number }; // ref AAAAMM, valor em reais
export type Tendencia = {
  nivel: "valorizando" | "estavel" | "queda" | "queda_seguida" | "sem_dados";
  meses: { ref: string; valor: number }[];  // mais antigo → mais novo (MM/AAAA)
  atual: number | null;
  anterior: number | null;
  variacao_mes: number | null;              // R$ (novo − anterior)
  variacao_mes_pct: number | null;          // %
  quedas_seguidas: number;
  altas_seguidas: number;
  variacao_periodo_pct: number | null;      // do mês mais antigo do histórico até agora
  desde: string | null;                     // MM/AAAA do mês mais antigo usado
  resumo: string;                           // frase curta pronta (sem quebra de linha)
};

const LIMIAR_PCT = 0.3; // abaixo disso (pra cima ou pra baixo) conta como estável

export const refStr = (ref: number) => `${String(ref % 100).padStart(2, "0")}/${Math.floor(ref / 100)}`;
const brl = (n: number) => `R$ ${Math.round(Math.abs(n)).toLocaleString("pt-BR")}`;
const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function calcTendencia(hist: MesFipe[]): Tendencia {
  const serie = [...hist].filter((h) => h.valor > 0).sort((a, b) => a.ref - b.ref).slice(-7);
  const meses = serie.map((h) => ({ ref: refStr(h.ref), valor: h.valor }));
  const vazio: Tendencia = {
    nivel: "sem_dados", meses, atual: serie.at(-1)?.valor ?? null, anterior: null,
    variacao_mes: null, variacao_mes_pct: null, quedas_seguidas: 0, altas_seguidas: 0,
    variacao_periodo_pct: null, desde: meses[0]?.ref ?? null, resumo: "ainda sem histórico suficiente pra comparar",
  };
  if (serie.length < 2) return vazio;

  const dir = (a: number, b: number) => {
    const p = ((b - a) / a) * 100;
    return p <= -LIMIAR_PCT ? -1 : p >= LIMIAR_PCT ? 1 : 0;
  };
  let quedas = 0, altas = 0;
  for (let i = serie.length - 1; i > 0; i--) {
    const d = dir(serie[i - 1].valor, serie[i].valor);
    if (d === -1 && altas === 0) quedas++;
    else if (d === 1 && quedas === 0) altas++;
    else break;
  }
  const atual = serie[serie.length - 1].valor;
  const anterior = serie[serie.length - 2].valor;
  const variacao = atual - anterior;
  const variacaoPct = (variacao / anterior) * 100;
  const periodoPct = ((atual - serie[0].valor) / serie[0].valor) * 100;

  const nivel: Tendencia["nivel"] = quedas >= 2 ? "queda_seguida" : quedas === 1 ? "queda" : altas >= 1 ? "valorizando" : "estavel";
  const desde = meses[0].ref;
  const resumo =
    nivel === "queda_seguida" ? `caiu ${brl(variacao)} (${pct(variacaoPct)}) e é o ${quedas}º mês seguido em queda (${pct(periodoPct)} desde ${desde})`
    : nivel === "queda" ? `caiu ${brl(variacao)} (${pct(variacaoPct)}) este mês`
    : nivel === "valorizando" ? `subiu ${brl(variacao)} (${pct(variacaoPct)}) este mês`
    : `está estável (${pct(variacaoPct)} no mês)`;

  return {
    nivel, meses, atual, anterior, variacao_mes: Math.round(variacao), variacao_mes_pct: Math.round(variacaoPct * 10) / 10,
    quedas_seguidas: quedas, altas_seguidas: altas, variacao_periodo_pct: Math.round(periodoPct * 10) / 10, desde, resumo,
  };
}

// Texto do 3º parâmetro do template valor_vivo_mensal (uma linha, sem quebra)
export function textoAlerta(t: Tendencia): string {
  if (t.nivel === "queda_seguida") return `${t.resumo}. Sinal de alerta: quedas seguidas costumam indicar que o valor vai continuar caindo, então pode ser a hora de avaliar uma troca`;
  if (t.nivel === "queda") return `${t.resumo}. Atenção: se cair de novo no próximo mês, é sinal de tendência de queda e eu te aviso na hora`;
  return t.resumo;
}

// ---- casamento placa/modelo → código FIPE (compartilhado com a quanto-vale) ----
export const normFipe = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// marca da placa → termos que aparecem na marca da FIPE (apelidos comuns)
export const MARCA_ALIAS: Record<string, string[]> = {
  gm: ["chevrolet"], "general motors": ["chevrolet"], chevrolet: ["chevrolet"], chev: ["chevrolet"], "gm chevrolet": ["chevrolet"],
  vw: ["volkswagen"], volkswagen: ["volkswagen"],
  mmc: ["mitsubishi"], mercedes: ["mercedes"], "mercedes benz": ["mercedes"],
  gwm: ["gwm"], byd: ["byd"], caoa: ["caoa", "chery"], "caoa chery": ["caoa", "chery"], chery: ["chery"],
  mini: ["mini"], citroen: ["citroen"], hyundai: ["hyundai"], renault: ["renault"], fiat: ["fiat"], ford: ["ford"],
};

// escolhe a melhor variante por sobreposição de tokens do modelo (+ dica de combustível)
export function ranquearFipe(rows: any[], modeloPlaca: string, comb: string | null, anoAlvo: number | null) {
  const toks = normFipe(modeloPlaca).split(" ").filter((t) => t.length >= 2);
  const combN = normFipe(comb || "");
  const isHib = /hibrid|phev|hev/.test(combN), isDies = /diesel/.test(combN), isEle = /eletric|ev\b/.test(combN);
  return rows.map((r: any) => {
    const nm = r.modelo_norm || normFipe(r.nome_modelo);
    let sc = toks.reduce((a, t) => a + (nm.includes(t) ? 1 : 0), 0);
    if (isHib) sc += /hibrid/.test(nm) ? 2 : -1;
    if (isDies && /diesel/.test(nm)) sc += 2;
    if (isEle && /eletric/.test(nm)) sc += 2;
    if (anoAlvo && r.ano_modelo === anoAlvo) sc += 0.5; // desempate: ano exato
    return { r, sc };
  }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
}

// ---- carro do dono → código FIPE + tendência (agente e alerta mensal) ----
// 1) usa o vínculo salvo em accounts; 2) senão, pela PLACA via quanto-vale (cache por placa);
// 3) senão, por marca/modelo/ano na fipe_tabela. Salva o vínculo pra não refazer.
export async function tendenciaDaConta(supabase: any, acc: any, fnBase: string, serviceKey: string): Promise<{
  codigo_fipe: string; ano: number; modelo: string | null; valor_atual: number | null; ref: string | null; tendencia: Tendencia;
} | null> {
  if (!acc?.id) return null;
  let codigo: string | null = acc.fipe_codigo || null;
  let ano: number | null = Number(acc.fipe_ano) || null;

  if (!codigo || !ano) {
    const placa = String(acc.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (placa.length >= 7) {
      try {
        const r = await fetch(`${fnBase}/quanto-vale`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ placa }),
        });
        const d = await r.json().catch(() => null);
        if (d?.codigo_fipe && d?.ano) { codigo = String(d.codigo_fipe); ano = Number(d.ano); }
      } catch { /* cai no casamento por modelo */ }
    }
    if ((!codigo || !ano) && acc.marca && acc.modelo) {
      const marcaN = normFipe(acc.marca);
      const alias = MARCA_ALIAS[marcaN] || [marcaN.split(" ")[0]];
      const anoAlvo = Number(acc.ano_modelo || acc.ano_fabricacao) || null;
      for (const a of alias) {
        let q = supabase.from("fipe_tabela").select("codigo_fipe, nome_modelo, modelo_norm, ano_modelo").ilike("marca_norm", `%${a}%`);
        if (anoAlvo) q = q.in("ano_modelo", [anoAlvo, anoAlvo - 1, anoAlvo + 1]);
        const { data: rows } = await q.limit(800);
        const rk = ranquearFipe(rows || [], String(acc.modelo), acc.combustivel || null, anoAlvo);
        if (rk.length && rk[0].sc >= 2) { codigo = rk[0].r.codigo_fipe; ano = rk[0].r.ano_modelo; break; }
      }
    }
    if (codigo && ano) await supabase.from("accounts").update({ fipe_codigo: codigo, fipe_ano: ano }).eq("id", acc.id);
  }
  if (!codigo || !ano) return null;

  const [{ data: hist }, { data: atual }] = await Promise.all([
    supabase.from("fipe_historico").select("ref, valor_centavos").eq("codigo_fipe", codigo).eq("ano_modelo", ano).order("ref", { ascending: false }).limit(7),
    supabase.from("fipe_tabela").select("nome_modelo, valor_centavos, ref_mes, ref_ano").eq("codigo_fipe", codigo).eq("ano_modelo", ano).limit(1),
  ]);
  const t = calcTendencia((hist || []).map((h: any) => ({ ref: Number(h.ref), valor: Math.round(Number(h.valor_centavos) / 100) })));
  const a0 = atual?.[0];
  return {
    codigo_fipe: codigo, ano, modelo: a0?.nome_modelo || null,
    valor_atual: a0?.valor_centavos ? Math.round(Number(a0.valor_centavos) / 100) : t.atual,
    ref: a0?.ref_mes && a0?.ref_ano ? `${String(a0.ref_mes).padStart(2, "0")}/${a0.ref_ano}` : null,
    tendencia: t,
  };
}
