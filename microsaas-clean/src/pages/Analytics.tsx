import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import { TrendingUp, TrendingDown, Target, Award, Calendar } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMonthlyTrend } from "@/hooks/useMonthlyTrend";
import { useCategoryStats, useWeeklyStats } from "@/hooks/useAnalytics";
import { useMonthlyStats } from "@/hooks/useTransactions";

// Mock data for charts
const categoryExpensesData = [
  { category: "Alimentação", amount: 1200, percentage: 35 },
  { category: "Transporte", amount: 800, percentage: 23 },
  { category: "Moradia", amount: 600, percentage: 18 },
  { category: "Lazer", amount: 400, percentage: 12 },
  { category: "Saúde", amount: 300, percentage: 9 },
  { category: "Outros", amount: 100, percentage: 3 },
];

const monthlyComparisonData = [
  { month: "Jun", receitas: 5200, gastos: 3800, meta: 4000 },
  { month: "Jul", receitas: 5500, gastos: 3200, meta: 4000 },
  { month: "Ago", receitas: 5800, gastos: 3500, meta: 4000 },
  { month: "Set", receitas: 5500, gastos: 3100, meta: 4000 },
  { month: "Out", receitas: 6200, gastos: 3800, meta: 4000 },
  { month: "Nov", receitas: 5500, gastos: 4200, meta: 4000 },
];

const weeklyTrendData = [
  { week: "Sem 1", income: 1400, expenses: 850 },
  { week: "Sem 2", income: 1200, expenses: 920 },
  { week: "Sem 3", income: 1600, expenses: 750 },
  { week: "Sem 4", income: 1300, expenses: 880 },
];

const topCategoriesData = [
  { name: "Alimentação", value: 35, color: "#8B5CF6" },
  { name: "Transporte", value: 23, color: "#06B6D4" },
  { name: "Moradia", value: 18, color: "#10B981" },
  { name: "Lazer", value: 12, color: "#F59E0B" },
  { name: "Outros", value: 12, color: "#6B7280" },
];

const Analytics = () => {
  const { userId } = useCurrentUser();
  const { data: monthlyData = [] } = useMonthlyTrend(userId);
  const { data: categoryStats = [] } = useCategoryStats(userId);
  const { data: weeklyStats = [] } = useWeeklyStats(userId);
  const { data: monthlyStats } = useMonthlyStats(userId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Preparar dados para os gráficos
  const topCategoriesData = categoryStats.slice(0, 5).map((cat, index) => ({
    name: cat.category,
    value: cat.percentage,
    color: cat.color || `hsl(${index * 60}, 70%, 50%)`
  }));

  const currentBalance = monthlyStats?.balance || 0;
  const balanceChange = monthlyStats?.changes?.balance || 0;
  const topCategory = categoryStats[0];

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Análises</h1>
          <p className="text-muted-foreground">
            Insights detalhados sobre os gastos do seu carro
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Este Mês
          </Button>
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-premium-md bg-gradient-primary text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-white/80 text-sm">Economia este mês</p>
                <p className="text-2xl font-bold">{formatCurrency(currentBalance)}</p>
                <p className="text-white/80 text-xs">
                  {balanceChange >= 0 ? '+' : ''}{balanceChange?.toFixed(1)}% vs mês anterior
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-premium-md bg-gradient-success text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <p className="text-white/80 text-sm">Meta de gastos</p>
                <p className="text-2xl font-bold">85%</p>
                <p className="text-white/80 text-xs">Dentro da meta</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-premium-md bg-warning text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-white/80 text-sm">Categoria top</p>
                <p className="text-2xl font-bold">{topCategory?.category || 'N/A'}</p>
                <p className="text-white/80 text-xs">
                  {topCategory?.percentage || 0}% dos gastos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly Comparison */}
        <Card className="border-0 shadow-premium-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Receitas vs Gastos vs Meta</CardTitle>
            <p className="text-sm text-muted-foreground">
              Comparativo mensal dos últimos 6 meses
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="month" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), ""]}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Bar dataKey="income" fill="hsl(var(--success))" name="Receitas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="hsl(var(--primary))" name="Gastos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="balance" fill="hsl(var(--warning))" name="Saldo" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Categories Pie Chart */}
        <Card className="border-0 shadow-premium-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Distribuição de Gastos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Top 5 categorias que mais consomem seu orçamento
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topCategoriesData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={40}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {topCategoriesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value}%`, ""]}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {topCategoriesData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-foreground">{item.name}</span>
                  <span className="text-sm text-muted-foreground">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend & Category Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Weekly Trend */}
        <Card className="xl:col-span-2 border-0 shadow-premium-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Tendência Semanal</CardTitle>
            <p className="text-sm text-muted-foreground">
              Fluxo de receitas e gastos por semana
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="week" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), ""]}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="income" 
                    stroke="hsl(var(--success))" 
                    strokeWidth={3}
                    name="Receitas"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="expenses" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    name="Gastos"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Rankings */}
        <Card className="border-0 shadow-premium-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Ranking de Categorias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryStats.slice(0, 5).map((category, index) => (
              <div key={category.category} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">#{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{category.category}</p>
                    <p className="text-xs text-muted-foreground">{category.percentage}% do total</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  {formatCurrency(category.amount)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Analytics;