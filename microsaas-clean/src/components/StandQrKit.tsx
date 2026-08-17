import { useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { QrCode, Printer, Loader2 } from "lucide-react";

const brl = (v: any) => v != null ? `R$ ${Number(v).toLocaleString("pt-BR")}` : "consulte";
const esc = (s: any) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

// Gera uma folha imprimível com 1 QR por carro do estoque da loja.
// Cada QR abre o WhatsApp com "#stand <slug> <promotor> <idDoCarro>" → o Co-pilot manda
// aquele carro em destaque + a vitrine + o presente, atribuído à loja/promotor/carro.
export function StandQrKit() {
  const [loading, setLoading] = useState(false);
  const [promotor, setPromotor] = useState("");

  const gerar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("dealer-api", { body: { action: "stand_qr_kit" } });
      if (error) throw error;
      const cars = ((data as any)?.cars || []) as any[];
      const slug = (data as any)?.slug as string;
      const loja = (data as any)?.loja_nome || "";
      const wa = (data as any)?.wa_number || "5511963786699";
      if (!slug || !cars.length) {
        toast({ title: "Nenhum carro encontrado", description: "Não achei estoque desta loja no marketplace.", variant: "destructive" });
        return;
      }
      const prom = (promotor.trim() || "balcao").toLowerCase().replace(/[^a-z0-9-]/g, "");

      // gera os QRs (data URLs) — local, sem serviço externo
      const cards = await Promise.all(cars.map(async (c) => {
        const msg = `Oi! Vim da ${loja} e quero ver este carro \u{1F697}\n#stand ${slug} ${prom} ${c.id}`;
        const link = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
        const qr = await QRCode.toDataURL(link, { width: 420, margin: 1, errorCorrectionLevel: "M" });
        const titulo = [c.brand, c.model].filter(Boolean).join(" ");
        const linha2 = [c.year, c.version].filter(Boolean).join(" · ");
        return `
          <div class="card">
            ${c.photo ? `<img class="foto" src="${esc(c.photo)}" />` : `<div class="foto sem">sem foto</div>`}
            <div class="tit">${esc(titulo)}</div>
            <div class="sub">${esc(linha2)}</div>
            <div class="preco">${esc(brl(c.price))}</div>
            <img class="qr" src="${qr}" />
            <div class="cta">Aponte a câmera e veja no WhatsApp</div>
            <div class="marca">TotexCar Co-pilot · ${esc(loja)}</div>
          </div>`;
      }));

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>QRs do estoque — ${esc(loja)}</title>
      <style>
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 10mm; background: #fff; color: #111; }
        .head { text-align:center; margin-bottom: 8mm; }
        .head h1 { font-size: 18px; margin: 0; }
        .head p { font-size: 12px; color: #666; margin: 4px 0 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
        .card { border: 1.5px solid #ddd; border-radius: 10px; padding: 8px 10px 12px; text-align: center; page-break-inside: avoid; }
        .foto { width: 100%; height: 46mm; object-fit: cover; border-radius: 8px; background:#f2f2f2; }
        .foto.sem { display:flex; align-items:center; justify-content:center; color:#aaa; font-size:12px; }
        .tit { font-weight: 700; font-size: 15px; margin-top: 8px; }
        .sub { font-size: 12px; color: #666; }
        .preco { font-weight: 700; font-size: 17px; color: #0a7f4f; margin: 3px 0 6px; }
        .qr { width: 42mm; height: 42mm; }
        .cta { font-size: 12px; font-weight: 600; margin-top: 2px; }
        .marca { font-size: 10px; color: #999; margin-top: 3px; }
        @page { size: A4; margin: 8mm; }
      </style></head><body>
        <div class="head"><h1>Escaneie e leve o carro no seu WhatsApp</h1><p>${esc(loja)} — ${cards.length} veículos · cole um em cada carro do pátio</p></div>
        <div class="grid">${cards.join("")}</div>
        <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 400); };</script>
      </body></html>`;

      const w = window.open("", "_blank");
      if (!w) { toast({ title: "Libere o pop-up", description: "O navegador bloqueou a janela de impressão. Permita pop-ups e tente de novo." }); return; }
      w.document.write(html); w.document.close();
      toast({ title: "Folha gerada ✅", description: `${cards.length} QRs prontos. Salve como PDF ou imprima.` });
    } catch (e: any) {
      toast({ title: "Não consegui gerar", description: String(e?.message || e), variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Card className="border-0 shadow-premium-md">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <div className="font-semibold flex items-center gap-2"><QrCode className="w-5 h-5 text-primary" /> QR por carro do estoque</div>
          <p className="text-sm text-muted-foreground mt-1">
            Gera uma folha com <strong>1 QR por veículo</strong> (com foto e preço). Cole um em cada carro do pátio — quem escanear
            recebe aquele carro no WhatsApp + os 30 dias, já atribuído à loja.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Promotor (opcional)</label>
            <Input value={promotor} onChange={(e) => setPromotor(e.target.value)} placeholder="balcao" className="h-9 w-28" />
          </div>
          <Button onClick={gerar} disabled={loading} className="gap-2 h-9">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Gerar folha
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
