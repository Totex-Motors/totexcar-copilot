import { useRef, useState } from "react";
import { Camera, Loader2, CheckCircle2 } from "lucide-react";
import { fotoComprimida } from "@/lib/foto";
import type { OrdemServico, StatusOS } from "@/hooks/useDealer";

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
};
export const msgErro = (e: unknown) => {
  const c = String((e as any)?.message || e || "");
  if (c.startsWith("carro_ja_tem_os_aberta_")) return `Esse carro já tem a OS #${c.split("_").pop()} em aberto.`;
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
