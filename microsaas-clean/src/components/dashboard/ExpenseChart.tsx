import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useCurrentUser } from "@/hooks/useAuth";
import { useCategoryStats } from "@/hooks/useCategories";

const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#6B7280'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-premium-md">
        <p className="font-medium text-foreground">{data.name}</p>
        <p className="text-primary font-semibold">{formatCurrency(data.totalAmount)}</p>
        <p className="text-sm text-muted-foreground">{data.percentage}% do total</p>
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap gap-4 justify-center mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-foreground font-medium">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export function ExpenseChart() {
  const { userId } = useCurrentUser();
  const { data: categoryStats = [], isLoading } = useCategoryStats(userId);
  
  // Filtrar apenas categorias de despesa e mapear para formato do gráfico
  const expenseData = categoryStats
    .filter(stat => stat.type === 'expense')
    .slice(0, 6) // Limitar a 6 categorias principais
    .map((stat, index) => ({
      name: stat.name,
      totalAmount: stat.totalAmount,
      percentage: stat.percentage,
      color: COLORS[index % COLORS.length]
    }));

  const total = expenseData.reduce((sum, item) => sum + item.totalAmount, 0);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-premium-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold">Gastos por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (expenseData.length === 0) {
    return (
      <Card className="border-0 shadow-premium-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold">Gastos por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">Nenhum gasto registrado este mês</p>
              <p className="text-sm text-muted-foreground mt-1">
                Registre os gastos do seu carro para ver a distribuição
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-semibold">Gastos por Categoria</CardTitle>
        <p className="text-sm text-muted-foreground">
          Total gasto este mês: <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={expenseData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="totalAmount"
              >
                {expenseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}