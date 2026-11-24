import { useRef, useState } from "react";
import { Camera, Loader2, CheckCircle2, FileText } from "lucide-react";
import { fotoComprimida } from "@/lib/foto";
import type { OrdemServico, StatusOS, ScannerLaudo, ScannerComparacao } from "@/hooks/useDealer";

// Peças comuns da ordem de serviço (tela do gerente e link da oficina parceira).

export const STATUS_OS: Record<StatusOS, { label: string; cls: string }> = {
  enviada: { label: "A caminho da oficina", cls: "bg-sky-100 text-sky-800" },
  recebida: { label: "Na oficina", cls: "bg-amber-100 text-amber-800" },
  concluida: { label: "Pronto p/ buscar", cls: "bg-green-100 text-green-800" },
  devolvida: { label: "Voltou p/ loja", cls: "bg-muted text-muted-foreground" },
  cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground line-through" },
};

const ERROS: Record<string, string> = {
  informe_o_km: "Informe o km do painel.",
  km_menor_que_na_saida: "O km está menor que o da saída da loja. Confira o painel.",
  km_menor_que_na_chegada: "O km está menor que o da chegada. Confira o painel.",
  foto_do_painel_obrigatoria: "A foto do painel é obrigatória (com o km aparecendo).",
  foto_da_etiqueta_obrigatoria: "A foto da etiqueta de troca de óleo é obrigatória.",
  viscosidade_invalida: "Informe a viscosidade do óleo no formato 5W30, 0W20, 10W40…",
  informe_a_norma_do_oleo: "Informe a norma/especificação do óleo (ex.: API SP, ACEA C3, VW 508.00).",
  informe_a_marca_do_oleo: "Informe a marca do óleo.",
  litros_invalidos: "Informe quantos litros de óleo foram usados.",
  descreva_o_servico_feito: "Descreva o que foi feito no carro.",
  confirme_a_chegada_antes: "Confirme a chegada do carro antes.",
  os_ja_recebida: "Esta ordem já foi recebida.",
  os_ja_concluida: "Este serviço já foi registrado.",
  ja_tem_extra_aguardando: "Já tem um extra aguardando a aprovação da loja.",
  descreva_o_que_encontrou: "Descreva o que encontrou.",
  foto_obrigatoria: "A foto é obrigatória.",
  escolha_a_oficina: "Escolha a oficina.",
  escolha_o_servico: "Escolha pelo menos um serviço.",
  informe_o_carro: "Escolha o carro.",
  informe_a_placa: "Informe a placa do carro (confira no carro).",
  placa_invalida: "Placa inválida. Use o formato ABC1D23 ou ABC1234.",
  servico_ainda_nao_registrado: "A oficina ainda não registrou o serviço.",
  km_invalido: "Km inválido (não pode ser menor que o km do serviço).",
  nao_da_para_cancelar: "Essa ordem não pode mais ser cancelada.",
  rode_o_sql_das_oficinas: "Falta rodar o SQL das oficinas parceiras no Supabase.",
  link_invalido: "Este link não vale mais.",
  envie_o_pdf_do_scanner: "Envie o relatório em PDF exportado pelo app do scanner (Doutor-IE).",
  arquivo_grande_demais: "O PDF passou de 15 MB. Exporte de novo pelo app do scanner.",
  falha_no_upload: "Não consegui enviar o arquivo. Confira a internet e tente de novo.",
  arquivo_invalido: "Arquivo inválido. Envie o PDF de novo.",
  arquivo_ja_registrado: "Esse relatório já foi registrado.",
  arquivo_nao_chegou: "O arquivo não chegou inteiro. Envie de novo.",
  nao_consegui_ler_o_pdf: "Não consegui ler esse PDF. Exporte o relatório de novo pelo app do scanner.",
  nao_parece_relatorio_do_scanner: "Esse PDF não parece o relatório do scanner (não achei placa, códigos de falha nem teste de bateria).",
  relatorio_sem_placa: "O relatório veio sem placa. Preencha a placa no app do scanner e exporte de novo.",
  rode_o_sql_do_scanner: "Falta criar a tabela do scanner no Supabase.",
};
export const msgErro = (e: unknown) => {
  const c = String((e as any)?.message || e || "");
  if (c.startsWith("carro_ja_tem_os_aberta_")) return `Esse carro já tem a OS #${c.split("_").pop()} em aberto.`;
  if (c.startsWith("placa_diferente_")) return `Esse relatório é de outro carro (placa ${c.split("_").pop()}). Envie o relatório do carro certo.`;
  return ERROS[c] || c || "Erro";
};

// onde está o carro do estoque que foi pra oficina parceira
export const textoOsCarro = (os: { numero: number; status: string; oficina: string }) =>
  os.status === "concluida" ? `✅ Pronto na ${os.oficina} (OS #${os.numero}): falta buscar` : `🔧 Na oficina ${os.oficina} (OS #${os.numero})`;
export const kmBR = (n?: number | null) => (n != null ? `${Number(n).toLocaleString("pt-BR")} km` : "");
export const quando = (s?: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
export const carroOS = (o: OrdemServico) => `${o.car_desc || "Carro"}${o.placa ? ` · ${o.placa}` : ""}`;
const inicial = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const servicosOS = (o: OrdemServico, nomes: Record<string, string>) => inicial((o.servicos || []).map((s) => nomes[s] || s).join(" + "));
export const nomeServico = (s: string, nomes: Record<string, string>) => inicial(nomes[s] || s);
export const oleoOS = (o: OrdemServico) => [o.oleo_viscosidade, o.oleo_norma, o.oleo_marca, o.oleo_litros ? `${String(o.oleo_litros).replace(".", ",")} L` : null].filter(Boolean).join(" · ");
export const filtrosOS = (o: OrdemServico) => [o.filtro_oleo && "óleo", o.filtro_ar && "ar", o.filtro_combustivel && "combustível", o.filtro_cabine && "cabine"].filter(Boolean).join(", ");

// Botão de foto: abre a câmera traseira no celular, comprime e devolve o data URL.
export function FotoInput({ label, valor, onChange, obrigatoria }: { label: string; valor: string | null; onChange: (v: string | null) => void; obrigatoria?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const escolher = async (f?: File) => {
    if (!f) return;
    setCarregando(true); setErro(false);
    try { onChange(await fotoComprimida(f)); } catch { onChange(null); setErro(true); } finally { setCarregando(false); }
  };
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium">{label}{obrigatoria && <span className="text-red-600"> *</span>}</div>
      <button type="button" onClick={() => ref.current?.click()}
        className={`w-full rounded-lg border-2 border-dashed ${valor ? "border-green-400 bg-green-50" : "border-muted-foreground/30"} p-2 flex items-center gap-3 text-left text-sm`}>
        {valor ? <img src={valor} alt="" className="w-16 h-16 rounded object-cover" /> : <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">{carregando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-6 h-6 text-muted-foreground" />}</div>}
        <span className="flex-1">{valor ? <span className="text-green-700 font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Foto ok · tocar pra trocar</span> : "Tirar foto"}</span>
      </button>
      {/* se a câmera do celular fechar a página, dá pra tirar a foto no app da câmera e escolher aqui */}
      <button type="button" onClick={() => galeria.current?.click()} className="text-[11.5px] text-primary underline">ou escolher da galeria</button>
      {erro && <div className="text-[11.5px] text-red-600">Não consegui ler essa foto. Tente de novo ou escolha da galeria.</div>}
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { escolher(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={galeria} type="file" accept="image/*" hidden onChange={(e) => { escolher(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

// Miniaturas das fotos da OS (toca e abre grande)
export function FotosOS({ o }: { o: OrdemServico }) {
  const itens = ([["foto_saida", "Saída da loja"], ["foto_chegada", "Chegada"], ["foto_painel", "Painel (serviço)"], ["foto_etiqueta", "Etiqueta"], ["foto_nota", "Nota"], ["extra_foto", "Extra"]] as const)
    .filter(([k]) => o.fotos?.[k]);
  if (!itens.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {itens.map(([k, label]) => (
        <a key={k} href={o.fotos[k]!} target="_blank" rel="noreferrer" className="text-center">
          <img src={o.fotos[k]!} alt={label} loading="lazy" className="w-20 h-20 rounded object-cover border" />
          <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
        </a>
      ))}
    </div>
  );
}

// Linha do tempo da OS: o que aconteceu, quando e com quantos km
export function LinhaDoTempo({ o }: { o: OrdemServico }) {
  const passos = [
    { ok: true, t: `Saiu da loja ${quando(o.enviada_em)}${o.km_saida ? ` · ${kmBR(o.km_saida)}` : ""}${o.enviada_por ? ` · ${o.enviada_por}` : ""}` },
    { ok: !!o.recebida_em, t: o.recebida_em ? `Chegou na oficina ${quando(o.recebida_em)} · ${kmBR(o.km_chegada)}${o.km_ida != null ? ` (${o.km_ida >= 0 ? "+" : ""}${o.km_ida} km na ida)` : ""}` : "Chegada na oficina" },
    { ok: !!o.concluida_em, t: o.concluida_em ? `Serviço registrado ${quando(o.concluida_em)} · ${kmBR(o.km_servico)}` : "Serviço registrado" },
    { ok: !!o.devolvida_em, t: o.devolvida_em ? `Voltou pra loja ${quando(o.devolvida_em)} · ${kmBR(o.km_volta)}${o.devolvida_por ? ` · ${o.devolvida_por}` : ""}` : "Volta pra loja" },
  ];
  return (
    <ol className="space-y-1 text-xs">
      {passos.map((p, i) => <li key={i} className={p.ok ? "text-foreground" : "text-muted-foreground"}>{p.ok ? "✅" : "⬜"} {p.t}</li>)}
    </ol>
  );
}

// ---------------- SCANNER (Doutor-IE) ----------------
const diaBR = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" }) : "");
export const seloScanner = (l: ScannerLaudo) =>
  l.n_falhas === 0 ? { t: "Sem falhas", cls: "bg-green-100 text-green-800" }
    : l.n_falhas == null ? { t: "Ver o PDF", cls: "bg-amber-100 text-amber-800" }
      : { t: `${l.n_falhas} falha${l.n_falhas === 1 ? "" : "s"}`, cls: "bg-red-100 text-red-800" };

// Laudo do scanner: selo, lista de falhas (código + descrição), bateria, km e o PDF
export function ScannerResumo({ l, titulo, compacto }: { l: ScannerLaudo; titulo: string; compacto?: boolean }) {
  const selo = seloScanner(l);
  const b = l.bateria;
  return (
    <div className={`rounded-lg border p-2 text-sm space-y-1 ${l.n_falhas ? "border-red-200 bg-red-50/60" : "bg-muted/40"}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">🔍 {titulo}</span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${selo.cls}`}>{selo.t}</span>
        <span className="text-xs text-muted-foreground">{diaBR(l.gerado_em)}{l.km ? ` · ${kmBR(l.km)}` : ""}</span>
      </div>
      {!!l.falhas.length && (
        <ul className="space-y-0.5">
          {l.falhas.slice(0, compacto ? 6 : 40).map((f) => <li key={f.codigo} className="text-[13px]"><b className="font-mono">{f.codigo}</b>{f.descricao ? ` · ${f.descricao}` : ""}</li>)}
          {compacto && l.falhas.length > 6 && <li className="text-xs text-muted-foreground">e mais {l.falhas.length - 6} no PDF</li>}
        </ul>
      )}
      {l.n_falhas == null && <div className="text-xs text-amber-800">Não deu pra ler a lista de falhas automaticamente. Abra o PDF.</div>}
      {b?.status && <div className={`text-xs ${b.status === "reprovada" ? "text-red-700 font-medium" : "text-muted-foreground"}`}>🔋 Bateria {b.status}{b.inicial != null ? ` · ${String(b.inicial).replace(".", ",")} V` : ""}{b.minima != null ? ` (mínima ${String(b.minima).replace(".", ",")} V)` : ""}</div>}
      {l.url && <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary underline"><FileText className="w-3.5 h-3.5" /> Abrir o relatório (PDF)</a>}
    </div>
  );
}
// Antes x depois do reparo
export function ComparacaoScanner({ c }: { c: ScannerComparacao }) {
  if (!c.resolvidas.length && !c.continuam.length && !c.novas.length) return null;
  return (
    <div className="text-xs space-y-0.5">
      {!!c.resolvidas.length && <div className="text-green-700">✅ Resolvidas: {c.resolvidas.join(", ")}</div>}
      {!!c.continuam.length && <div className="text-red-700 font-medium">⚠️ Continuam depois do reparo: {c.continuam.join(", ")}</div>}
      {!!c.novas.length && <div className="text-amber-800">🆕 Novas: {c.novas.join(", ")}</div>}
    </div>
  );
}
// Escolher o PDF do scanner: sobe na hora e devolve o caminho (vai junto no registro do serviço / da volta)
export function PdfScannerInput({ label, valor, onChange, subir, destaque }: { label: string; valor: string | null; onChange: (path: string | null) => void; subir: (f: File) => Promise<string>; destaque?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const escolher = async (f?: File) => {
    if (!f) return;
    setCarregando(true); setErro("");
    try { onChange(await subir(f)); } catch (e) { onChange(null); setErro(msgErro(e)); } finally { setCarregando(false); }
  };
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium">{label}</div>
      <button type="button" onClick={() => ref.current?.click()} disabled={carregando}
        className={`w-full rounded-lg border-2 border-dashed ${valor ? "border-green-400 bg-green-50" : destaque ? "border-red-300 bg-red-50/50" : "border-muted-foreground/30"} p-2.5 flex items-center gap-3 text-left text-sm`}>
        <span className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">{carregando ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5 text-muted-foreground" />}</span>
        <span className="flex-1">{carregando ? "Enviando o PDF…" : valor ? <span className="text-green-700 font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> PDF enviado · tocar pra trocar</span> : "Escolher o PDF do scanner"}</span>
      </button>
      {erro && <div className="text-[11.5px] text-red-600">{erro}</div>}
      <input ref={ref} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { escolher(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
