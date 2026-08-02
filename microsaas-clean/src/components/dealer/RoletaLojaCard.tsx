import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2, Disc3, Plus, Trash2, Unlock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Roleta Totex — configuração da loja: fatias (prêmio + peso + ESTOQUE), missões que
// destravam giros, liberação de giro validado e resgate dos prêmios sorteados.

interface Fatia { rotulo: string; peso: number; estoque: number | null; cor?: string | null }
interface GiroLoja { id: string; cliente: string; missao: string; premio: string | null; codigo: string | null; status: string; girado_em: string | null }

async function chamar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("roleta", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

const FATIA_NOVA: Fatia = { rotulo: "", peso: 1, estoque: null };

export function RoletaLojaCard({ dealership }: { dealership?: string }) {
  const qc = useQueryClient();
  const escopo = dealership ? { dealership } : {};
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const [fatias, setFatias] = useState<Fatia[]>([]);
  const [missoes, setMissoes] = useState<Record<string, { on: boolean }>>({});
  const [salvando, setSalvando] = useState(false);
  const [fone, setFone] = useState("");
  const [missaoLib, setMissaoLib] = useState("google");
  const [liberando, setLiberando] = useState(false);

  const { data: cfgData } = useQuery({
    queryKey: ["roleta-cfg", dealership || null],
    queryFn: () => chamar({ action: "cfg", ...escopo }),
  });
  const { data: resgates } = useQuery({
    queryKey: ["roleta-resgates", dealership || null],
    queryFn: () => chamar({ action: "resgates", ...escopo }),
    refetchInterval: 60_000,
  });

  const catalogo: Record<string, { titulo: string; auto: boolean }> = cfgData?.missoes_catalogo || {};

  useEffect(() => {
    const c = cfgData?.config;
    if (!c) return;
    setAtivo(!!c.ativo);
    setFatias(Array.isArray(c.fatias) && c.fatias.length ? c.fatias : []);
    setMissoes(c.missoes || {});
  }, [cfgData]);

  const setFatia = (i: number, patch: Partial<Fatia>) =>
    setFatias((p) => p.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  const salvar = async () => {
    setSalvando(true);
    try {
      await chamar({ action: "cfg_save", ativo, fatias, missoes, ...escopo });
      toast({ title: "Roleta salva 🎡", description: ativo ? "Ativa para os clientes da loja no app." : "Configuração guardada (roleta desligada)." });
      qc.invalidateQueries({ queryKey: ["roleta-cfg"] });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: String(e?.message || e), variant: "destructive" });
    } finally { setSalvando(false); }
  };

  const liberar = async () => {
    setLiberando(true);
    try {
      const r = await chamar({ action: "liberar", phone: fone, missao: missaoLib, ...escopo });
      toast({ title: `Giro liberado para ${r.cliente} ✅` });
      setFone("");
      qc.invalidateQueries({ queryKey: ["roleta-resgates"] });
    } catch (e: any) {
      const msg = String(e?.message || e);
      toast({
        title: "Não foi possível liberar",
        description: msg.includes("ja_liberado") ? "Este cliente já ganhou o giro dessa missão." : msg.includes("cliente_nao_encontrado") ? "Nenhum cliente da loja com esse WhatsApp." : msg,
        variant: "destructive",
      });
    } finally { setLiberando(false); }
  };

  const entregar = async (id: string) => {
    try {
      await chamar({ action: "entregar", giro_id: id, ...escopo });
      qc.invalidateQueries({ queryKey: ["roleta-resgates"] });
    } catch (e: any) {
      toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" });
    }
  };

  const pendentes = (resgates?.giros || []).filter((g: GiroLoja) => g.status === "girado");
  const usados: Record<string, number> = resgates?.usados || {};

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Disc3 className="w-4 h-4 text-primary" /> Roleta de Prêmios
            {ativo ? <Badge className="bg-green-500/15 text-green-600">Ativa</Badge> : <Badge className="bg-muted text-muted-foreground">Desligada</Badge>}
            {!!pendentes.length && <Badge className="bg-amber-500/15 text-amber-600">{pendentes.length} resgate(s) pendente(s)</Badge>}
          </span>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setAberto((v) => !v)}>{aberto ? "Fechar" : "Configurar"}</Button>
        </CardTitle>
        <p className="text-[12px] text-muted-foreground">
          O cliente ganha giros cumprindo missões que valem ouro pra loja (avaliar no Google, seguir no Instagram, engajar no Co-pilot) — e você controla prêmios, chances e estoque.
        </p>
      </CardHeader>
      {aberto && (
        <CardContent className="space-y-5">
          {/* fatias */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">Prêmios da roleta (fatias)</Label>
            {fatias.map((f, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input className="flex-1" placeholder="Ex.: Lavagem grátis" value={f.rotulo} onChange={(e) => setFatia(i, { rotulo: e.target.value })} />
                <span className="text-[11px] text-muted-foreground">chance</span>
                <Input type="number" min={0} className="w-16 text-center" value={String(f.peso)} onChange={(e) => setFatia(i, { peso: Number(e.target.value) })} />
                <span className="text-[11px] text-muted-foreground">estoque</span>
                <Input type="number" min={0} className="w-16 text-center" placeholder="∞" value={f.estoque == null ? "" : String(f.estoque)} onChange={(e) => setFatia(i, { estoque: e.target.value === "" ? null : Number(e.target.value) })} />
                {f.rotulo && usados[f.rotulo] != null && <span className="text-[11px] text-muted-foreground whitespace-nowrap">{usados[f.rotulo]} dado(s)</span>}
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setFatias((p) => p.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFatias((p) => [...p, { ...FATIA_NOVA }])}><Plus className="w-3.5 h-3.5" /> Adicionar prêmio</Button>
            <p className="text-[11px] text-muted-foreground">Chance = peso relativo entre as fatias. Estoque vazio = ilimitado; com estoque esgotado a fatia deixa de ser sorteada — a roleta nunca dá mais do que você definiu.</p>
          </div>

          {/* missões */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">Missões que dão giro</Label>
            {Object.entries(catalogo).map(([k, m]) => (
              <label key={k} className="flex items-center gap-2.5 rounded-lg border p-2.5 cursor-pointer text-sm">
                <Checkbox checked={!!missoes[k]?.on} onCheckedChange={(v) => setMissoes((p) => ({ ...p, [k]: { on: v === true } }))} />
                <span className="flex-1">{m.titulo}</span>
                <Badge className={m.auto ? "bg-green-500/15 text-green-600" : "bg-primary/15 text-primary"}>{m.auto ? "automática" : "você libera"}</Badge>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <Checkbox checked={ativo} onCheckedChange={(v) => setAtivo(v === true)} /> Roleta ativa para os clientes
            </label>
            <Button size="sm" className="gap-1.5" disabled={salvando} onClick={salvar}>
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Disc3 className="w-3.5 h-3.5" />} Salvar roleta
            </Button>
          </div>

          {/* liberar giro validado */}
          <div className="rounded-lg border border-dashed p-3 space-y-2">
            <Label className="text-xs font-bold flex items-center gap-1.5"><Unlock className="w-3.5 h-3.5" /> Liberar giro validado</Label>
            <p className="text-[12px] text-muted-foreground">O cliente mostrou a avaliação no Google ou que seguiu o Instagram? Libere o giro dele aqui.</p>
            <div className="flex gap-2 flex-wrap">
              <Input className="w-44" placeholder="WhatsApp do cliente" value={fone} onChange={(e) => setFone(e.target.value)} />
              <select className="border rounded-md px-2 text-sm bg-background" value={missaoLib} onChange={(e) => setMissaoLib(e.target.value)}>
                {Object.entries(catalogo).filter(([, m]) => !m.auto).map(([k, m]) => <option key={k} value={k}>{m.titulo}</option>)}
              </select>
              <Button size="sm" className="gap-1.5" disabled={liberando || !fone} onClick={liberar}>
                {liberando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />} Liberar
              </Button>
            </div>
          </div>

          {/* resgates */}
          {!!(resgates?.giros || []).length && (
            <div className="space-y-1">
              <Label className="text-xs font-bold">Prêmios sorteados</Label>
              <div className="divide-y divide-border">
                {(resgates.giros as GiroLoja[]).map((g) => (
                  <div key={g.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{g.premio} · <span className="text-primary font-bold">{g.codigo}</span></p>
                      <p className="text-xs text-muted-foreground truncate">{g.cliente}</p>
                    </div>
                    {g.status === "entregue" ? (
                      <Badge className="bg-green-500/15 text-green-600 shrink-0 gap-1"><CheckCircle2 className="w-3 h-3" /> Entregue</Badge>
                    ) : (
                      <Button variant="outline" size="sm" className="h-7 shrink-0" onClick={() => entregar(g.id)}>Marcar entregue</Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default RoletaLojaCard;
