import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Printer, Tag, Link2, Unlink, QrCode, Smartphone } from "lucide-react";
import { useTagsList, useTagsCreate, useTagsBind, useTagsUnbind, useTagsLogoSave, usePostsaleList, type CarTag } from "@/hooks/useDealer";

// ETIQUETAS QR DO PARA-BRISA — o adesivo "de troca de óleo" com QR. Cada etiqueta tem um número (CV-0001)
// e um QR próprio; a loja imprime o lote uma vez, cola na entrega e vincula ao cliente. O cliente escaneia,
// o Co-pilot reconhece o telefone e ele só confirma "sim, começar". Carro revendido: o dono novo assume.
const esc = (s: any) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const STATUS: Record<string, { label: string; cls: string }> = {
  livre: { label: "Livre", cls: "bg-muted text-muted-foreground" },
  vinculada: { label: "Vinculada", cls: "bg-amber-500/15 text-amber-600" },
  ativa: { label: "Ativa", cls: "bg-green-500/15 text-green-600" },
  inativa: { label: "Inativa", cls: "bg-muted text-muted-foreground" },
};
const rel = (s?: string | null) => {
  if (!s) return "";
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  return d <= 0 ? "hoje" : d === 1 ? "ontem" : `${d} d`;
};

// Folha A4 com 12 adesivos (50 × 65 mm), FRENTE E VERSO. Vai pra gráfica em vinil frente-e-verso pra vidro:
//   página 1 = VERSO (lado do motorista): QR em azul + nº + frase.
//   página 2 = FRENTE (lado do vidro, visto de fora): logo da loja + frase da marca, mesma posição de cada adesivo.
const NAVY = "#000080";
async function imprimirFolha(tags: { label: string; token: string }[], loja: string, appUrl: string, logoUrl?: string | null) {
  const logo = logoUrl ? (/^https?:\/\//i.test(logoUrl) ? logoUrl : `${window.location.origin}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`) : "";
  const versos = await Promise.all(tags.map(async (t) => {
    const url = `${appUrl}/q/${t.token}`;
    const qr = await QRCode.toDataURL(url, { width: 480, margin: 0, errorCorrectionLevel: "M", color: { dark: NAVY, light: "#ffffff" } });
    return `
      <div class="st verso">
        <div class="topo">MANUTENÇÃO DO SEU CARRO</div>
        <div class="qrbox"><img class="qr" src="${qr}" /></div>
        <div class="num">${esc(t.label)}</div>
        <div class="cta">Aponte a câmera e acompanhe<br/>a manutenção do seu carro</div>
        <div class="marca">TotexCar Co-pilot</div>
      </div>`;
  }));
  const frentes = tags.map((t) => `
      <div class="st frente">
        <div class="logowrap">${logo ? `<img class="logo" src="${esc(logo)}" />` : `<div class="lojatxt">${esc(loja).toUpperCase()}</div>`}</div>
        <div class="slogan">Nós ajudamos você<br/>a cuidar do seu carro.</div>
        <div class="numf">${esc(t.label)}</div>
      </div>`);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ${esc(tags[0]?.label || "")} – ${esc(tags[tags.length - 1]?.label || "")} — ${esc(loja)}</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4; margin: 8mm; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: ${NAVY}; background: #fff; }
    .grid { display: grid; grid-template-columns: repeat(3, 50mm); grid-auto-rows: 65mm; gap: 6mm 8mm; justify-content: center; padding-top: 2mm; }
    .pg2 { page-break-before: always; break-before: page; }
    .st { width: 50mm; height: 65mm; border: 0.3mm dashed #bbb; border-radius: 3mm; overflow: hidden; text-align: center; display: flex; flex-direction: column; align-items: center; page-break-inside: avoid; break-inside: avoid; background: #fff; }
    /* VERSO (QR) */
    .verso { justify-content: space-between; padding: 0 2.5mm 2.5mm; }
    .topo { width: 50mm; background: ${NAVY}; color: #fff; font-size: 6.5pt; font-weight: 800; letter-spacing: .18em; padding: 1.8mm 0; }
    .qrbox { border: 0.5mm solid ${NAVY}; border-radius: 2.5mm; padding: 2mm; margin-top: 1mm; }
    .qr { width: 30mm; height: 30mm; display: block; }
    .num { font-family: "Courier New", monospace; font-weight: 700; font-size: 11pt; letter-spacing: .12em; color: ${NAVY}; }
    .cta { font-size: 8pt; line-height: 1.3; font-weight: 700; color: ${NAVY}; }
    .marca { font-size: 6.5pt; color: #8a8fa8; letter-spacing: .06em; }
    /* FRENTE (logo) */
    .frente { justify-content: center; gap: 3.5mm; padding: 4mm 3mm; position: relative; }
    .logowrap { width: 42mm; height: 16mm; display: flex; align-items: center; justify-content: center; }
    .logo { max-width: 42mm; max-height: 16mm; }
    .lojatxt { font-size: 12pt; font-weight: 900; letter-spacing: .06em; }
    .slogan { font-size: 8.5pt; line-height: 1.3; font-weight: 700; font-style: italic; }
    .numf { position: absolute; bottom: 2mm; right: 0; left: 0; font-family: "Courier New", monospace; font-size: 6pt; color: #8a8fa8; letter-spacing: .1em; }
  </style></head><body>
    <div class="grid">${versos.join("")}</div>
    <div class="grid pg2">${frentes.join("")}</div>
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 700); };</script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast({ title: "Libere o pop-up", description: "O navegador bloqueou a janela de impressão. Permita pop-ups e tente de novo." }); return; }
  w.document.write(html); w.document.close();
}

export function EtiquetasTab({ dealership }: { dealership?: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useTagsList(true, dealership);
  const { data: journeys } = usePostsaleList(true, dealership);
  const criar = useTagsCreate();
  const vincular = useTagsBind();
  const desvincular = useTagsUnbind();
  const salvarLogo = useTagsLogoSave();

  const [qty, setQty] = useState("50");
  const [prefix, setPrefix] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null); // null = ainda não editado (usa o do servidor)
  const [bind, setBind] = useState({ label: "", journey_id: "", customer_name: "", customer_phone: "", car_desc: "", placa: "", km_entrega: "" });
  const [filtro, setFiltro] = useState("");
  const [printing, setPrinting] = useState(false);

  const tags = data?.tags || [];
  const resumo = data?.resumo;
  const loja = dealership || tags[0]?.dealership || "Totex Motors";
  const refresh = () => qc.invalidateQueries({ queryKey: ["car-tags"] });

  const lotes = useMemo(() => {
    const m = new Map<string, CarTag[]>();
    for (const t of tags) { const k = t.batch || "sem lote"; if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
    return Array.from(m.entries()).sort((a, b) => (b[0] > a[0] ? 1 : -1));
  }, [tags]);

  const lista = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return tags;
    return tags.filter((t) => [t.label, t.customer_name, t.customer_phone, t.car_desc, t.placa, t.status].filter(Boolean).join(" ").toLowerCase().includes(f));
  }, [tags, filtro]);

  const appUrl = () => (import.meta.env.VITE_APP_URL as string) || window.location.origin;
  const logoAtual = logoUrl ?? data?.logo_url ?? "";

  const gerarLote = () => {
    criar.mutate({ qty: Number(qty) || 50, prefix: prefix || undefined, dealership: dealership || undefined }, {
      onSuccess: async (r) => {
        toast({ title: `Lote gerado: ${r.tags.length} etiquetas`, description: `${r.tags[0]?.label} a ${r.tags[r.tags.length - 1]?.label}. Abrindo a folha de impressão…` });
        refresh();
        await imprimirFolha(r.tags, r.loja || loja, r.app_url || appUrl(), logoAtual);
      },
      onError: (e: any) => toast({ title: "Não consegui gerar o lote", description: String(e?.message || e), variant: "destructive" }),
    });
  };

  const imprimirLote = async (lote: CarTag[]) => {
    setPrinting(true);
    try { await imprimirFolha(lote, loja, appUrl(), logoAtual); } finally { setPrinting(false); }
  };

  const gravarLogo = () => {
    salvarLogo.mutate({ logo_url: logoAtual, dealership: dealership || undefined }, {
      onSuccess: () => { toast({ title: "Logo salvo ✅" }); setLogoUrl(null); refresh(); },
      onError: (e: any) => toast({ title: "Erro ao salvar o logo", description: String(e?.message || e), variant: "destructive" }),
    });
  };

  const escolherJornada = (id: string) => {
    const j = (journeys || []).find((x) => x.id === id);
    setBind((p) => ({ ...p, journey_id: id, customer_name: j?.customer_name || "", customer_phone: j?.customer_phone || "", car_desc: j?.car_desc || "" }));
  };

  const vincularAgora = () => {
    if (!bind.label.trim()) { toast({ title: "Informe o nº da etiqueta", description: "É o número impresso embaixo do QR (ex.: CV-0001).", variant: "destructive" }); return; }
    if (!bind.journey_id && bind.customer_phone.replace(/\D/g, "").length < 10) { toast({ title: "Escolha o cliente ou informe o WhatsApp", variant: "destructive" }); return; }
    vincular.mutate({
      label: bind.label, journey_id: bind.journey_id || undefined,
      customer_phone: bind.customer_phone || undefined, customer_name: bind.customer_name || undefined,
      car_desc: bind.car_desc || undefined, placa: bind.placa || undefined, km_entrega: Number(bind.km_entrega) || undefined,
      dealership: dealership || undefined,
    }, {
      onSuccess: (r: any) => {
        toast({ title: `Etiqueta ${r?.tag?.label} vinculada ✅`, description: "Quando o cliente escanear, o Co-pilot já reconhece o carro dele." });
        setBind({ label: "", journey_id: "", customer_name: "", customer_phone: "", car_desc: "", placa: "", km_entrega: "" });
        refresh();
      },
      onError: (e: any) => toast({ title: "Não foi possível vincular", description: msgErro(String(e?.message || e)), variant: "destructive" }),
    });
  };

  const soltar = (t: CarTag) => {
    if (!confirm(`Desvincular a etiqueta ${t.label}? Ela volta a ficar livre pra outro carro.`)) return;
    desvincular.mutate({ label: t.label, dealership: dealership || undefined }, {
      onSuccess: () => { toast({ title: `Etiqueta ${t.label} liberada` }); refresh(); },
      onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Etiquetas" value={String(resumo?.total ?? 0)} />
        <Kpi label="Livres (na gaveta)" value={String(resumo?.livres ?? 0)} />
        <Kpi label="Vinculadas" value={String(resumo?.vinculadas ?? 0)} accent="text-amber-600" hint="coladas, cliente ainda não confirmou" />
        <Kpi label="Ativas" value={String(resumo?.ativas ?? 0)} accent="text-green-600" hint="cliente confirmou no WhatsApp" />
        <Kpi label="Scans" value={String(resumo?.scans ?? 0)} accent="text-primary" />
      </div>

      <Card className="border-0 shadow-premium-md bg-primary/5">
        <CardContent className="p-4 text-sm flex gap-3">
          <Smartphone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p>
            <strong>Como funciona:</strong> gere um lote, mande imprimir em adesivo (vinil para-brisa, 50 × 65 mm), guarde na gaveta.
            Na entrega do carro, cole no para-brisa e vincule o nº da etiqueta ao cliente (aqui ou direto no formulário de pós-venda).
            Quando ele apontar a câmera, o Co-pilot reconhece o WhatsApp dele e pergunta só "quer começar?". Se o carro for revendido,
            o dono novo escaneia e assume, e vira cliente da loja de novo.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gerar lote */}
        <Card className="border-0 shadow-premium-md">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><QrCode className="w-4 h-4 text-primary" /> Gerar lote de etiquetas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Cada etiqueta sai com um QR próprio e um número (ex.: CV-0001). Nada do cliente vai no adesivo. A folha abre pronta pra salvar em PDF: página 1 é o <strong>verso</strong> (QR, lado do motorista) e página 2 a <strong>frente</strong> (logo, lado do vidro).</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Quantidade</Label><Input type="number" min={1} max={500} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Prefixo (opcional)</Label><Input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="CV" maxLength={4} /></div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Logo da loja (frente da etiqueta)</Label>
                <div className="flex gap-2">
                  <Input value={logoAtual} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://… .png (fundo transparente) ou /etiqueta/sua-loja.png" />
                  <Button variant="outline" onClick={gravarLogo} disabled={salvarLogo.isPending || logoUrl === null}>{salvarLogo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}</Button>
                </div>
                {logoAtual && <img src={/^https?:\/\//i.test(logoAtual) ? logoAtual : `${window.location.origin}${logoAtual.startsWith("/") ? "" : "/"}${logoAtual}`} alt="logo" className="h-10 object-contain mt-1" />}
              </div>
            </div>
            <Button onClick={gerarLote} disabled={criar.isPending} className="gap-1.5">
              {criar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Gerar e imprimir
            </Button>
            {lotes.length > 0 && (
              <div className="pt-2 border-t space-y-1">
                <Label className="text-xs text-muted-foreground">Reimprimir um lote</Label>
                <div className="flex flex-wrap gap-2">
                  {lotes.map(([nome, ts]) => (
                    <Button key={nome} variant="outline" size="sm" className="h-8 gap-1.5" disabled={printing} onClick={() => imprimirLote(ts)}>
                      <Printer className="w-3.5 h-3.5" /> {nome} ({ts.length})
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vincular */}
        <Card className="border-0 shadow-premium-md">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Link2 className="w-4 h-4 text-primary" /> Vincular etiqueta a um cliente</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Nº da etiqueta</Label><Input value={bind.label} onChange={(e) => setBind((p) => ({ ...p, label: e.target.value.toUpperCase() }))} placeholder="CV-0001" /></div>
              <div className="space-y-1">
                <Label className="text-xs">Cliente do pós-venda</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={bind.journey_id} onChange={(e) => escolherJornada(e.target.value)}>
                  <option value="">— escolher ou preencher abaixo —</option>
                  {(journeys || []).map((j) => <option key={j.id} value={j.id}>{j.customer_name || j.customer_phone}{j.car_desc ? ` · ${j.car_desc}` : ""}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={bind.customer_name} onChange={(e) => setBind((p) => ({ ...p, customer_name: e.target.value }))} placeholder="Nome do cliente" /></div>
              <div className="space-y-1"><Label className="text-xs">WhatsApp (com DDD)</Label><Input value={bind.customer_phone} onChange={(e) => setBind((p) => ({ ...p, customer_phone: e.target.value }))} placeholder="11987654321" /></div>
              <div className="space-y-1"><Label className="text-xs">Carro</Label><Input value={bind.car_desc} onChange={(e) => setBind((p) => ({ ...p, car_desc: e.target.value }))} placeholder="Ex.: Corolla XEi 2022" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Placa</Label><Input value={bind.placa} onChange={(e) => setBind((p) => ({ ...p, placa: e.target.value.toUpperCase() }))} placeholder="ABC1D23" maxLength={8} /></div>
                <div className="space-y-1"><Label className="text-xs">Km na entrega</Label><Input type="number" inputMode="numeric" value={bind.km_entrega} onChange={(e) => setBind((p) => ({ ...p, km_entrega: e.target.value }))} placeholder="48200" /></div>
              </div>
            </div>
            <Button onClick={vincularAgora} disabled={vincular.isPending} className="gap-1.5">
              {vincular.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Vincular
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2"><Tag className="w-4 h-4 text-primary" /> Etiquetas ({lista.length})</CardTitle>
            <Input className="max-w-xs h-9" placeholder="Buscar por nº, cliente, placa…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : !lista.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma etiqueta ainda. Gere o primeiro lote acima. 👆</p>
          ) : (
            <div className="divide-y divide-border">
              {lista.map((t) => {
                const st = STATUS[t.status] || STATUS.livre;
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex items-center gap-3">
                      <span className="font-mono font-semibold text-sm shrink-0">{t.label}</span>
                      <div className="min-w-0">
                        <p className="text-sm truncate">{t.customer_name || t.customer_phone || <span className="text-muted-foreground">livre</span>}{t.car_desc ? <span className="text-muted-foreground"> · {t.car_desc}{t.placa ? ` · ${t.placa}` : ""}</span> : null}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[t.km_entrega ? `${Number(t.km_entrega).toLocaleString("pt-BR")} km na entrega` : null, t.scans ? `${t.scans} scan${t.scans > 1 ? "s" : ""}${t.last_scan_at ? ` (último ${rel(t.last_scan_at)})` : ""}` : "nunca escaneada", t.transfers ? `${t.transfers} transferência(s)` : null].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={st.cls}>{st.label}</Badge>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Imprimir só esta" onClick={() => imprimirLote([t])}><Printer className="w-3.5 h-3.5" /></Button>
                      {t.status !== "livre" && <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Desvincular" onClick={() => soltar(t)}><Unlink className="w-3.5 h-3.5" /></Button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function msgErro(e: string) {
  const m: Record<string, string> = {
    etiqueta_nao_encontrada: "Esse nº não existe. Confere o número impresso embaixo do QR.",
    etiqueta_de_outra_loja: "Essa etiqueta é de outro lote/loja.",
    cliente_nao_encontrado: "Cliente não encontrado no pós-venda desta loja.",
    telefone_invalido: "Informe o WhatsApp do cliente com DDD.",
  };
  return m[e] || e;
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card className="border-0 shadow-premium-md">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${accent || ""}`}>{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default EtiquetasTab;
