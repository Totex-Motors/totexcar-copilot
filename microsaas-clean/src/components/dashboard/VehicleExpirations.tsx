import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, ShieldCheck, FileText, ScrollText, CreditCard, ArrowRight } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useNavigate } from "react-router-dom";

type Status = "vencido" | "critico" | "alerta" | "ok" | "sem-data";

interface ExpItem {
  label: string;
  date: string | null;
  icon: React.ElementType;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function statusOf(date: string | null): { status: Status; days: number | null } {
  if (!date) return { status: "sem-data", days: null };
  const days = daysUntil(date);
  if (days < 0) return { status: "vencido", days };
  if (days <= 15) return { status: "critico", days };
  if (days <= 30) return { status: "alerta", days };
  return { status: "ok", days };
}

const STATUS_STYLES: Record<Status, { badge: string; label: (days: number | null) => string }> = {
  vencido: { badge: "bg-destructive text-destructive-foreground", label: (d) => `Vencido há ${Math.abs(d || 0)}d` },
  critico: { badge: "bg-destructive/15 text-destructive", label: (d) => `Vence em ${d}d` },
  alerta: { badge: "bg-warning/15 text-warning", label: (d) => `Vence em ${d}d` },
  ok: { badge: "bg-success/15 text-success", label: (d) => `Vence em ${d}d` },
  "sem-data": { badge: "bg-muted text-muted-foreground", label: () => "Não informado" },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function VehicleExpirations() {
  const { userId } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  const { data: userProfile } = useUserProfile(userId);
  const navigate = useNavigate();

  const items: ExpItem[] = [
    { label: "Licenciamento", date: vehicle?.licenciamento_vencimento ?? null, icon: ScrollText },
    { label: "IPVA", date: vehicle?.ipva_vencimento ?? null, icon: FileText },
    { label: "Seguro", date: vehicle?.seguro_vencimento ?? null, icon: ShieldCheck },
    { label: "CNH", date: userProfile?.cnh_vencimento ?? null, icon: CreditCard },
  ];

  // Ordena por urgência (vencidos/críticos primeiro)
  const ranked = items
    .map((item) => ({ item, ...statusOf(item.date) }))
    .sort((a, b) => {
      const av = a.days === null ? Infinity : a.days;
      const bv = b.days === null ? Infinity : b.days;
      return av - bv;
    });

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-primary" />
          Vencimentos & Documentos
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate("/settings")}>
          Atualizar
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {ranked.map(({ item, status, days }) => {
          const style = STATUS_STYLES[status];
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="w-4 h-4 text-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                </div>
              </div>
              <Badge className={`${style.badge} border-0`}>{style.label(days)}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
