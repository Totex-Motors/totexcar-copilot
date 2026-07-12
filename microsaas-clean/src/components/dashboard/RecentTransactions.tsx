import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useAuth";
import { useRecentTransactions } from "@/hooks/useTransactions";
import { useNavigate } from "react-router-dom";

export function RecentTransactions() {
  const { userId } = useCurrentUser();
  const { data: transactions = [], isLoading } = useRecentTransactions(userId);
  const navigate = useNavigate();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const getCategoryColor = (category: any) => {
    if (category?.color) {
      return {
        backgroundColor: category.color
      };
    }
    return {
      backgroundColor: "hsl(var(--primary))"
    };
  };

  if (isLoading) {
    return (
      <Card className="col-span-2 border-0 shadow-premium-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Gastos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                <div className="w-10 h-10 bg-muted rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
                <div className="h-4 bg-muted rounded w-20"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card className="col-span-2 border-0 shadow-premium-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Gastos Recentes</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Nenhum gasto encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Comece registrando o primeiro gasto do seu carro
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2 border-0 shadow-premium-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">Transações Recentes</CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-primary hover:text-primary-glow"
          onClick={() => navigate('/transactions')}
        >
          Ver todas
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-2 rounded-lg flex items-center justify-center",
                transaction.type === "income" ? "bg-success/10" : "bg-destructive/10"
              )}>
                {transaction.type === "income" ? (
                  <ArrowUpRight className="h-4 w-4 text-success" />
                ) : (
                  <ArrowDownLeft className="h-4 w-4 text-destructive" />
                )}
              </div>
              
              <div className="space-y-1">
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                  {transaction.description || 'Transação sem descrição'}
                </p>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="secondary" 
                    className="text-xs text-white"
                    style={getCategoryColor(transaction.categories)}
                  >
                    {transaction.categories?.name || 'Sem categoria'}
                  </Badge>
                  {transaction.accounts && (
                    <span className="text-sm text-muted-foreground">
                      {transaction.accounts.name}
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {formatDate(transaction.transaction_date || transaction.created_at)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <p className={cn(
                "font-semibold",
                transaction.type === "income" ? "text-success" : "text-foreground"
              )}>
                {transaction.type === "income" ? "+" : "-"}
                {formatCurrency(transaction.amount)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}