import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, FileText, Wrench, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";

interface Notif {
  icon: any;
  title: string;
  desc: string;
  urgent: boolean;
  url: string;
}

const daysUntil = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("T")[0].split("-").map(Number);
  const t = new Date(y, (m || 1) - 1, d || 1); t.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
};

const fmtPrazo = (dias: number) =>
  dias < 0 ? `venceu há ${Math.abs(dias)} dia(s)` : dias === 0 ? "vence HOJE" : dias === 1 ? "vence amanhã" : `vence em ${dias} dias`;

// Notificações REAIS do usuário: documentos vencendo (≤30d), manutenção por km e prazo de multa.
export function NotificationsBell() {
  const { userId } = useCurrentUser();
  const navigate = useNavigate();

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async (): Promise<Notif[]> => {
      const out: Notif[] = [];

      const [{ data: veh }, { data: me }, { data: rem }, { data: multas }] = await Promise.all([
        supabase.from("accounts").select("name, marca, modelo, hodometro, licenciamento_vencimento, ipva_vencimento, seguro_vencimento")
          .eq("user_id", userId!).eq("is_active", true).limit(1).maybeSingle(),
        supabase.from("users").select("cnh_vencimento").eq("id", userId!).maybeSingle(),
        supabase.from("maintenance_reminders").select("title, interval_km, last_km").eq("user_id", userId!).eq("active", true),
        (supabase as any).from("multas").select("descricao, prazo_recurso, status")
          .eq("user_id", userId!).in("status", ["nova", "recurso_gerado"]).not("prazo_recurso", "is", null),
      ]);

      // documentos (≤30 dias ou vencidos)
      const docs: Array<[string, string | null | undefined]> = [
        ["Licenciamento", veh?.licenciamento_vencimento],
        ["IPVA", veh?.ipva_vencimento],
        ["Seguro", veh?.seguro_vencimento],
        ["CNH", (me as any)?.cnh_vencimento],
      ];
      for (const [tipo, data] of docs) {
        const d = daysUntil(data);
        if (d != null && d <= 30) {
          out.push({ icon: FileText, title: tipo, desc: fmtPrazo(d), urgent: d <= 7, url: tipo === "CNH" ? "/settings" : "/settings" });
        }
      }

      // manutenção por km (vencida ou ≤500 km)
      const km = Number(veh?.hodometro || 0);
      for (const r of rem || []) {
        const faltam = Number(r.interval_km) - (km - Number(r.last_km || 0));
        if (faltam <= 500) {
          out.push({
            icon: Wrench, title: r.title,
            desc: faltam <= 0 ? `vencida há ${Math.abs(faltam).toLocaleString("pt-BR")} km` : `faltam ${faltam.toLocaleString("pt-BR")} km`,
            urgent: faltam <= 0, url: "/manutencao",
          });
        }
      }

      // multas com prazo de recurso ≤7 dias
      for (const m of multas || []) {
        const d = daysUntil(m.prazo_recurso);
        if (d != null && d >= 0 && d <= 7) {
          out.push({ icon: ShieldAlert, title: "Prazo de recurso de multa", desc: `${m.descricao || "multa"} · ${fmtPrazo(d)}`, urgent: d <= 3, url: "/multas" });
        }
      }

      return out.sort((a, b) => Number(b.urgent) - Number(a.urgent));
    },
  });

  const count = notifs.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Notificações">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 bg-destructive rounded-full flex items-center justify-center">
              <span className="text-[10px] text-destructive-foreground font-bold">{count > 9 ? "9+" : count}</span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border">
          <p className="font-semibold text-sm">Notificações</p>
          <p className="text-xs text-muted-foreground">Vencimentos, manutenção e prazos do seu carro</p>
        </div>
        {count === 0 ? (
          <div className="px-4 py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">Tudo em dia por aqui! 🎉</p>
            <p className="text-xs text-muted-foreground mt-1">Aviso quando algo estiver vencendo.</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifs.map((n, i) => (
              <button
                key={i}
                onClick={() => navigate(n.url)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.urgent ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                  <n.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  <p className={`text-xs ${n.urgent ? "text-destructive font-medium" : "text-muted-foreground"}`}>{n.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
