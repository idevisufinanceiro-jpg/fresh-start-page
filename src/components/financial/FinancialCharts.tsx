import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Legend,
  AreaChart,
  Area
} from "recharts";
import { format, subMonths, parseISO, startOfMonth, endOfMonth, addMonths, isBefore, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFinancialRealtime } from "@/hooks/useFinancialRealtime";

export function FinancialCharts() {
  // Realtime updates
  useFinancialRealtime();
  const { data: chartData } = useQuery({
    queryKey: ["financial-charts-updated"],
    queryFn: async () => {
      const [entriesRes, subscriptionsRes, subPaymentsRes] = await Promise.all([
        supabase.from("financial_entries").select("*, expense_categories(name, color)").order("created_at"),
        supabase.from("subscriptions").select("*").eq("is_active", true),
        supabase.from("subscription_payments").select("*"),
      ]);
      
      const entries = entriesRes.data || [];
      const subscriptions = subscriptionsRes.data || [];
      const subscriptionPayments = subPaymentsRes.data || [];

      // IDs de financial_entries que vieram de subscription_payments (para evitar duplicação)
      const subscriptionFinancialEntryIds = new Set(
        subscriptionPayments
          .filter((p: any) => p.financial_entry_id)
          .map((p: any) => p.financial_entry_id)
      );

      // Last 6 months
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(new Date(), 5 - i);
        return {
          key: format(date, "yyyy-MM"),
          label: format(date, "MMM", { locale: ptBR }),
          start: startOfMonth(date),
          end: endOfMonth(date),
        };
      });

      // Monthly data including subscriptions
      const monthlyData = last6Months.map(month => {
        // Financial entries income (paid only, excluindo as de assinatura)
        const paidIncome = entries
          .filter(e => e.type === "income" && e.payment_status === "paid" && !subscriptionFinancialEntryIds.has(e.id))
          .filter(e => {
            const paidDate = e.paid_at ? parseISO(e.paid_at) : null;
            if (paidDate) {
              return isWithinInterval(paidDate, { start: month.start, end: month.end });
            }
            return false;
          })
          .reduce((sum, e) => sum + Number(e.amount), 0);

        // Subscription payments (paid only)
        const paidSubscriptions = subscriptionPayments
          .filter((p: any) => p.payment_status === "paid" && p.paid_at)
          .filter((p: any) => {
            const paidDate = parseISO(p.paid_at!);
            return isWithinInterval(paidDate, { start: month.start, end: month.end });
          })
          .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

        // Expenses (paid only)
        const paidExpenses = entries
          .filter(e => e.type === "expense" && e.payment_status === "paid")
          .filter(e => {
            const paidDate = e.paid_at ? parseISO(e.paid_at) : null;
            if (paidDate) {
              return isWithinInterval(paidDate, { start: month.start, end: month.end });
            }
            return false;
          })
          .reduce((sum, e) => sum + Number(e.amount), 0);

        const totalReceitas = paidIncome + paidSubscriptions;
        
        return {
          month: month.label,
          receitas: totalReceitas,
          despesas: paidExpenses,
          lucro: totalReceitas - paidExpenses,
        };
      });

      // Expense categories (paid expenses only)
      const categoryData: Record<string, { total: number; color: string }> = {};
      entries
        .filter(e => e.type === "expense" && e.payment_status === "paid" && e.expense_categories)
        .forEach(entry => {
          const name = entry.expense_categories?.name || "Outros";
          const color = entry.expense_categories?.color || "#6b7280";
          if (!categoryData[name]) {
            categoryData[name] = { total: 0, color };
          }
          categoryData[name].total += Number(entry.amount);
        });

      const categoryChartData = Object.entries(categoryData).map(([name, data]) => ({
        name,
        value: data.total,
        color: data.color,
      }));

      // Payment status breakdown - excluindo entries de assinatura
      const paidIncomeTotal = entries
        .filter(e => e.type === "income" && e.payment_status === "paid" && !subscriptionFinancialEntryIds.has(e.id))
        .reduce((sum, e) => sum + Number(e.amount), 0);
      
      const pendingIncomeTotal = entries
        .filter(e => e.type === "income" && (e.payment_status === "pending" || e.payment_status === "partial") && !subscriptionFinancialEntryIds.has(e.id))
        .reduce((sum, e) => sum + Number(e.remaining_amount || e.amount), 0);

      const paidExpenseTotal = entries
        .filter(e => e.type === "expense" && e.payment_status === "paid")
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const pendingExpenseTotal = entries
        .filter(e => e.type === "expense" && e.payment_status === "pending")
        .reduce((sum, e) => sum + Number(e.amount), 0);

      // Add subscription payments
      const paidSubPayments = subscriptionPayments
        .filter((p: any) => p.payment_status === "paid")
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      // Calculate pending subscription payments (future months)
      let pendingSubPayments = 0;
      const today = new Date();
      const futureLimit = addMonths(today, 12);
      
      subscriptions.forEach((subscription: any) => {
        const startDate = parseISO(subscription.start_date);
        const endDate = subscription.end_date ? parseISO(subscription.end_date) : futureLimit;
        let currentMonth = startOfMonth(startDate);
        
        while (isBefore(currentMonth, endDate) && isBefore(currentMonth, futureLimit)) {
          const month = currentMonth.getMonth() + 1;
          const year = currentMonth.getFullYear();

          const existingPayment = subscriptionPayments.find(
            (p: any) => p.subscription_id === subscription.id && p.month === month && p.year === year
          );

          if (!existingPayment || existingPayment.payment_status === "pending") {
            pendingSubPayments += Number(subscription.monthly_value);
          }

          currentMonth = addMonths(currentMonth, 1);
        }
      });

      return {
        monthly: monthlyData,
        categories: categoryChartData,
        status: {
          income: { 
            paid: paidIncomeTotal + paidSubPayments, 
            pending: pendingIncomeTotal + pendingSubPayments 
          },
          expense: { 
            paid: paidExpenseTotal, 
            pending: pendingExpenseTotal 
          },
        },
      };
    },
  });

  const statusChartData = [
    { name: "Receitas Recebidas", value: chartData?.status.income.paid || 0, color: "hsl(var(--accent))" },
    { name: "Receitas Pendentes", value: chartData?.status.income.pending || 0, color: "#f59e0b" },
    { name: "Despesas Pagas", value: chartData?.status.expense.paid || 0, color: "hsl(var(--destructive))" },
    { name: "Despesas Pendentes", value: chartData?.status.expense.pending || 0, color: "#f87171" },
  ].filter(item => item.value > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="shadow-card lg:col-span-2">
        <CardHeader>
          <CardTitle>Receitas vs Despesas (Últimos 6 meses - Pagos)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData?.monthly || []}>
              <defs>
                <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-muted-foreground" />
              <YAxis className="text-muted-foreground" />
              <Tooltip 
                formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="receitas" 
                stroke="hsl(var(--accent))" 
                fillOpacity={1} 
                fill="url(#colorReceitas)" 
              />
              <Area 
                type="monotone" 
                dataKey="despesas" 
                stroke="hsl(var(--destructive))" 
                fillOpacity={1} 
                fill="url(#colorDespesas)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Despesas Pagas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData?.categories && chartData.categories.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.categories}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              Nenhuma despesa categorizada
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Status de Pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {statusChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={130} className="text-xs" />
                <Tooltip 
                  formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              Nenhum lançamento registrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
