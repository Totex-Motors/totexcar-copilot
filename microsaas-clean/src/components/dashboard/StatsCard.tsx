import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  change?: {
    value: string;
    type: "increase" | "decrease";
  };
  icon: React.ReactNode;
  gradient?: "primary" | "success" | "warning";
}

export function StatsCard({ title, value, change, icon, gradient = "primary" }: StatsCardProps) {
  const gradientClasses = {
    primary: "bg-gradient-primary",
    success: "bg-gradient-success", 
    warning: "bg-warning",
  };

  return (
    <Card className="overflow-hidden border-0 shadow-premium-md hover:shadow-premium-lg transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-foreground">{value}</p>
              {change && (
                <div className="flex items-center gap-1">
                  {change.type === "increase" ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  <span className={cn(
                    "text-sm font-medium",
                    change.type === "increase" ? "text-success" : "text-destructive"
                  )}>
                    {change.value}
                  </span>
                  <span className="text-sm text-muted-foreground">vs mês anterior</span>
                </div>
              )}
            </div>
          </div>
          
          <div className={cn(
            "p-3 rounded-xl shadow-premium-md group-hover:shadow-premium-glow transition-all duration-300",
            gradientClasses[gradient]
          )}>
            <div className="text-white">
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}