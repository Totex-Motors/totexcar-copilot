// Leitura do PDF do scanner (biblioteca de PDF). Separado de scanner.ts pra que só a função do painel
// (dealer-api) carregue a biblioteca: o webhook do WhatsApp usa só os dados já gravados.
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
import { BUCKET, MAX_PDF, PLACA_OK, caminhoDaLoja, lerLaudo, limpaPlaca, type LaudoLido } from "./scanner.ts";

export async function textoDoPdf(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  return (Array.isArray(text) ? text : [String(text || "")]).map((t) => String(t || ""));
}

// O PDF já está no Storage (upload assinado). Lê, confere e grava o laudo. Erros em código (a tela traduz).
export async function registrarLaudo(sb: any, o: {
  loja: string; path: string; momento: "entrada" | "conferencia" | "avulso"; osId?: string | null;
  vehicleId?: string | null; carDesc?: string | null; placa?: string | null; enviadoPor?: string | null;
}): Promise<{ laudo: any } | { erro: string }> {
  if (!caminhoDaLoja(o.loja, o.path)) return { erro: "arquivo_invalido" };
  const { data: ja } = await sb.from("scanner_laudos").select("id").eq("arquivo", o.path).limit(1);
  if (ja?.length) return { erro: "arquivo_ja_registrado" };
  const { data: blob, error } = await sb.storage.from(BUCKET).download(o.path);
  if (error || !blob) return { erro: "arquivo_nao_chegou" };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const apagar = () => sb.storage.from(BUCKET).remove([o.path]).catch(() => null);
  if (bytes.length > MAX_PDF) { await apagar(); return { erro: "arquivo_grande_demais" }; }
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) { await apagar(); return { erro: "envie_o_pdf_do_scanner" }; }
  let lido: LaudoLido;
  try { lido = lerLaudo(await textoDoPdf(bytes)); } catch (e) { console.error("scanner pdf:", e); await apagar(); return { erro: "nao_consegui_ler_o_pdf" }; }
  if (!lido.reconhecido) { await apagar(); return { erro: "nao_parece_relatorio_do_scanner" }; }
  const placaInf = limpaPlaca(o.placa);
  // a placa do relatório manda; se a pessoa informou outra, recusa (relatório do carro errado)
  if (lido.placa && PLACA_OK.test(placaInf) && lido.placa !== placaInf) { await apagar(); return { erro: `placa_diferente_${lido.placa}` }; }
  const placa = lido.placa || (PLACA_OK.test(placaInf) ? placaInf : null);
  if (!placa) { await apagar(); return { erro: "relatorio_sem_placa" }; }
  const { data: laudo, error: e2 } = await sb.from("scanner_laudos").insert({
    dealership: o.loja, placa, vehicle_id: o.vehicleId || null, car_desc: (o.carDesc || lido.car_desc || "").slice(0, 120) || null,
    momento: o.momento, os_id: o.osId || null, titulo: lido.titulo, gerado_em: lido.gerado_em, km: lido.km,
    n_falhas: lido.n_falhas, falhas: lido.falhas, bateria: lido.bateria, compressao: lido.compressao,
    arquivo: o.path, reconhecido: true, enviado_por: o.enviadoPor || null,
  }).select("*").single();
  if (e2 || !laudo) { await apagar(); return { erro: /relation|does not exist/i.test(String(e2?.message)) ? "rode_o_sql_do_scanner" : "falha_ao_gravar" }; }
  return { laudo };
}

