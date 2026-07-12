import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMonthlyTrend } from "@/hooks/useMonthlyTrend";

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

const mockMonthlyData: MonthlyData[] = [
  { month: "Ago", income: 5500, expenses: 3200, balance: 2300 },
  { month: "Set", income: 5800, expenses: 3500, balance: 2300 },
  { month: "Out", income: 5500, expenses: 3100, balance: 2400 },
  { month: "Nov", income: 6200, expenses: 3800, balance: 2400 },
  { month: "Dez", income: 5500, expenses: 4200, balance: 1300 },
  { month: "Jan", income: 5500, expenses: 3400, balance: 2100 },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 shadow-premium-md">
        <p className="font-medium text-foreground mb-2">{label}</p>
        {payload.map((item: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-foreground">
              {item.name}: <span className="font-semibold">{formatCurrency(item.value)}</span>
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function MonthlyTrend() {
  const { userId } = useCurrentUser();
  const { data: monthlyData = [], isLoading } = useMonthlyTrend(userId);

  if (isLoading) {
    return (
      <Card className="col-span-2 border-0 shadow-premium-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Evolução Mensal</CardTitle>
          <p className="text-sm text-muted-foreground">
            Comparativo de receitas, gastos e saldo nos últimos 6 meses
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando dados...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2 border-0 shadow-premium-md">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Evolução Mensal</CardTitle>
        <p className="text-sm text-muted-foreground">
          Comparativo de receitas, gastos e saldo nos últimos 6 meses
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
              />
              <Line 
                type="monotone" 
                dataKey="income" 
                stroke="hsl(var(--success))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--success))", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: "hsl(var(--success))", strokeWidth: 2, fill: "hsl(var(--success))" }}
                name="Receitas"
              />
              <Line 
                type="monotone" 
                dataKey="expenses" 
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "hsl(var(--primary))" }}
                name="Gastos"
              />
              <Line 
                type="monotone" 
                dataKey="balance" 
                stroke="hsl(var(--warning))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--warning))", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: "hsl(var(--warning))", strokeWidth: 2, fill: "hsl(var(--warning))" }}
                name="Saldo"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}