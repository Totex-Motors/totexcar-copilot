import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, RefreshCw, ScanLine, Users, Gift, MessageCircle, UserCheck } from "lucide-react";

type Row = {
  loja: string; loja_nome?: string; promotor: string;
  escaneios: number; pessoas: number; presentes: number;
  conversaram: number; ativacoes: number; ultimo_scan: string | null;
};

const fmtData = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

// componente reutilizável: /admin (todas as lojas) e /lojista (só a loja dele)
export function StandLeadsPanel({ source }: { source: "admin" | "dealer" }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const fn = source === "admin" ? "admin-api" : "dealer-api";
      const { data } = await supabase.functions.invoke(fn, { body: { action: "stand_report" } });
      setRows(((data as any)?.rows || []) as Row[]);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [source]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    escaneios: a.escaneios + Number(r.escaneios || 0),
    pessoas: a.pessoas + Number(r.pessoas || 0),
    presentes: a.presentes + Number(r.presentes || 0),
    ativacoes: a.ativacoes + Number(r.ativacoes || 0),
  }), { escaneios: 0, pessoas: 0, presentes: 0, ativacoes: 0 }), [rows]);

  // agrupa por loja (no /admin mostra o nome da loja; no /lojista é uma só)
  const grupos = useMemo(() => {
    const m = new Map<string, { nome: string; rows: Row[] }>();
    for (const r of rows) {
      const key = r.loja;
      if (!m.has(key)) m.set(key, { nome: r.loja_nome || r.loja, rows: [] });
      m.get(key)!.rows.push(r);
    }
    return [...m.values()];
  }, [rows]);

  const KPI = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: string }) => (
    <Card className="border-0 shadow-premium-md"><CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon} {label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone || ""}`}>{value}</div>
    </CardContent></Card>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2"><QrCode className="w-5 h-5 text-primary" /> Leads do Stand</h3>
          <p className="text-sm text-muted-foreground">Quem escaneou o QR do stand — por loja e por promotor.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={<ScanLine className="w-4 h-4" />} label="Escaneios" value={totals.escaneios} />
        <KPI icon={<Users className="w-4 h-4" />} label="Pessoas" value={totals.pessoas} />
        <KPI icon={<Gift className="w-4 h-4" />} label="Ganharam presente" value={totals.presentes} tone="text-primary" />
        <KPI icon={<UserCheck className="w-4 h-4" />} label="Ativaram 30 dias" value={totals.ativacoes} tone="text-success" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" /></div>
      ) : rows.length === 0 ? (
        <Card className="border-0 shadow-premium-md"><CardContent className="p-8 text-center text-muted-foreground">
          Nenhum escaneio de stand ainda. Assim que alguém ler o QR, aparece aqui — por loja e por promotor.
        </CardContent></Card>
      ) : (
        <div className="space-y-5">
          {grupos.map((g) => (
            <Card key={g.nome} className="border-0 shadow-premium-md overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 font-semibold flex items-center gap-2 border-b">
                <span>📍 {g.nome}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {g.rows.reduce((s, r) => s + Number(r.escaneios || 0), 0)} escaneios
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="px-4 py-2 font-medium">Promotor</th>
                      <th className="px-3 py-2 font-medium text-center">Escaneios</th>
                      <th className="px-3 py-2 font-medium text-center">Pessoas</th>
                      <th className="px-3 py-2 font-medium text-center">Presente</th>
                      <th className="px-3 py-2 font-medium text-center">Conversaram</th>
                      <th className="px-3 py-2 font-medium text-center">Ativaram</th>
                      <th className="px-4 py-2 font-medium text-right">Último</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">{r.promotor === "(sem promotor)" ? "— balcão / sem promotor" : r.promotor}</td>
                        <td className="px-3 py-2.5 text-center">{r.escaneios}</td>
                        <td className="px-3 py-2.5 text-center">{r.pessoas}</td>
                        <td className="px-3 py-2.5 text-center text-primary font-medium">{r.presentes}</td>
                        <td className="px-3 py-2.5 text-center">{r.conversaram}</td>
                        <td className="px-3 py-2.5 text-center text-success font-semibold">{r.ativacoes}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">{fmtData(r.ultimo_scan)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
