import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  ArrowUpRight,
  DollarSign,
  Settings2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHideValues } from "@/hooks/useHideValues";
import { useFinancialRealtime } from "@/hooks/useFinancialRealtime";
import { useMonthlyReceivables } from "@/hooks/useMonthlyReceivables";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from "recharts";
import { format, subMonths, startOfYear, endOfYear, getYear, parseISO, addMonths, isBefore, isAfter, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface WidgetSettings {
  showSummaryCards: boolean;
  showCategoryChart: boolean;
  showComparisonChart: boolean;
  showMonthlyReceivables: boolean;
}

const defaultSettings: WidgetSettings = {
  showSummaryCards: true,
  showCategoryChart: true,
  showComparisonChart: true,
  showMonthlyReceivables: true,
};

export function FinancialDashboard() {
  // Realtime updates
  useFinancialRealtime();
  
  // Dados de "A Receber por Mês" centralizados
  const { data: monthlyReceivables } = useMonthlyReceivables();
  
  const { hideValues, toggleHideValues, formatValue } = useHideValues();
  const [settings, setSettings] = useState<WidgetSettings>(() => {
    const saved = localStorage.getItem("financial-dashboard-settings");
    return saved ? JSON.parse(saved) : defaultSettings;
  });
  const [showAllReceivables, setShowAllReceivables] = useState(false);

  const saveSettings = (newSettings: WidgetSettings) => {
    setSettings(newSettings);
    localStorage.setItem("financial-dashboard-settings", JSON.stringify(newSettings));
  };

  const { data } = useQuery({
    queryKey: ["financial-dashboard-data"],
    staleTime: 10000, // 10 segundos
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const currentYear = getYear(new Date());
      const yearStart = startOfYear(new Date());
      const yearEnd = endOfYear(new Date());

      const { data: entries, error } = await supabase
        .from("financial_entries")
        .select("*, expense_categories(name, color)")
        .order("created_at");
      
      if (error) throw error;

      // Fetch subscription payments
      const { data: subscriptionPayments, error: subPaymentsError } = await supabase
        .from("subscription_payments")
        .select(`
          id, 
          amount, 
          month, 
          year, 
          payment_status,
          subscription_id,
          financial_entry_id,
          subscription:subscriptions(title, payment_day, customer:customers(name))
        `);

      if (subPaymentsError) throw subPaymentsError;

      // Get IDs of financial entries that come from subscription payments (to avoid duplication)
      const subscriptionFinancialEntryIds = new Set(
        (subscriptionPayments || [])
          .filter(p => p.financial_entry_id)
          .map(p => p.financial_entry_id)
      );

      // Fetch active subscriptions to generate future months
      const { data: subscriptions, error: subsError } = await supabase
        .from("subscriptions")
        .select(`
          id,
          title,
          monthly_value,
          start_date,
          end_date,
          is_active,
          payment_day,
          customer:customers(name)
        `)
        .eq("is_active", true);

      if (subsError) throw subsError;

      // Calculate summary
      // Exclude income entries that come from subscriptions (to avoid duplication in summary)
      const income = entries?.filter(e => e.type === "income" && !subscriptionFinancialEntryIds.has(e.id)) || [];
      const expenses = entries?.filter(e => e.type === "expense") || [];

      // Calculate paid subscription income (from subscription_payments)
      const paidSubscriptionIncome = (subscriptionPayments || [])
        .filter(p => p.payment_status === "paid")
        .reduce((sum, p) => sum + Number(p.amount), 0);

      // Annual income (current year) - paid entries from financial + paid subscriptions
      const paidIncomeFromFinancial = income
        .filter(e => new Date(e.created_at).getFullYear() === currentYear && e.payment_status === "paid")
        .reduce((sum, e) => sum + Number(e.amount), 0);
      
      const paidSubscriptionIncomeCurrentYear = (subscriptionPayments || [])
        .filter(p => p.payment_status === "paid" && p.year === currentYear)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const annualIncome = paidIncomeFromFinancial + paidSubscriptionIncomeCurrentYear;

      // Total paid income (all time)
      const paidIncomeAllTime = income.filter(e => e.payment_status === "paid")
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const paidIncome = paidIncomeAllTime + paidSubscriptionIncome;

      const pendingIncome = income.filter(e => e.payment_status === "pending" || e.payment_status === "partial")
        .reduce((sum, e) => sum + Number(e.remaining_amount || e.amount), 0);

      // Pending income for current month only (based on due_date)
      const currentMonthStart = startOfMonth(new Date());
      const currentMonthEnd = endOfMonth(new Date());
      
      const pendingIncomeCurrentMonth = income
        .filter(e => {
          if (e.payment_status !== "pending" && e.payment_status !== "partial") return false;
          if (!e.due_date) return false;
          const dueDate = parseISO(e.due_date);
          return isWithinInterval(dueDate, { start: currentMonthStart, end: currentMonthEnd });
        })
        .reduce((sum, e) => sum + Number(e.remaining_amount || e.amount), 0);

      // Calculate pending subscription total (from existing pending payments + future months without payment records)
      let pendingSubscriptionTotal = 0;
      let pendingSubscriptionCurrentMonth = 0;
      const today = new Date();
      const futureLimit = addMonths(today, 12);
      const thisMonth = today.getMonth() + 1;
      const thisYear = today.getFullYear();
      
      (subscriptions || []).forEach(subscription => {
        const startDate = parseISO(subscription.start_date);
        const endDate = subscription.end_date ? parseISO(subscription.end_date) : futureLimit;
        const monthlyValue = Number(subscription.monthly_value);

        let currentMonth = startOfMonth(startDate);
        
        while (isBefore(currentMonth, endDate) && isBefore(currentMonth, futureLimit)) {
          const month = currentMonth.getMonth() + 1;
          const year = currentMonth.getFullYear();

          const existingPayment = (subscriptionPayments || []).find(
            p => p.subscription_id === subscription.id && p.month === month && p.year === year
          );

          // Add to pending if no payment exists or payment is pending
          if (!existingPayment || existingPayment.payment_status === "pending") {
            pendingSubscriptionTotal += monthlyValue;
            
            // Check if this is current month
            if (month === thisMonth && year === thisYear) {
              pendingSubscriptionCurrentMonth += monthlyValue;
            }
          }

          currentMonth = addMonths(currentMonth, 1);
        }
      });

      // Total pending for current month
      const pendingCurrentMonthTotal = pendingIncomeCurrentMonth + pendingSubscriptionCurrentMonth;

      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const paidExpenses = expenses.filter(e => e.payment_status === "paid")
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const balance = paidIncome - paidExpenses;

      // Monthly data for chart
      const monthlyData: Record<string, { income: number; expense: number }> = {};
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(new Date(), 5 - i);
        return format(date, "yyyy-MM");
      });

      last6Months.forEach(month => {
        monthlyData[month] = { income: 0, expense: 0 };
      });

      entries?.forEach(entry => {
        // Usar due_date para receitas (data do recebimento) e created_at para despesas
        // IMPORTANTE: parseISO evita o shift de timezone em datas "YYYY-MM-DD" (ex: 01/01 virar 31/12)
        const dateRef = entry.type === "income" && entry.due_date 
          ? parseISO(entry.due_date)
          : new Date(entry.created_at);
        const month = format(dateRef, "yyyy-MM");
        if (monthlyData[month]) {
          if (entry.type === "income") {
            monthlyData[month].income += Number(entry.amount);
          } else {
            monthlyData[month].expense += Number(entry.amount);
          }
        }
      });

      const monthlyChartData = Object.entries(monthlyData).map(([month, data]) => ({
        month: format(parseISO(month + "-01"), "MMM", { locale: ptBR }),
        fullMonth: format(parseISO(month + "-01"), "MMMM 'de' yyyy", { locale: ptBR }),
        receitas: data.income,
        despesas: data.expense,
      }));

      // Category data
      const categoryData: Record<string, { total: number; color: string }> = {};
      entries?.filter(e => e.type === "expense" && e.expense_categories).forEach(entry => {
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

      // Monthly receivables breakdown - agrupado por mês de vencimento (due_date), independente do status
      const receivablesData: Record<string, { total: number; entries: any[] }> = {};
      
      // Add financial entries (excluding those that come from subscription payments to avoid duplication)
      income.forEach(entry => {
        // Usar due_date como referência, só incluir se tiver due_date
        if (!entry.due_date) return;
        
        // Skip entries that come from subscription payments (they are handled separately)
        if (subscriptionFinancialEntryIds.has(entry.id)) return;
        
        const dueDate = parseISO(entry.due_date);
        const monthKey = format(dueDate, "yyyy-MM");
        if (!receivablesData[monthKey]) {
          receivablesData[monthKey] = { total: 0, entries: [] };
        }
        const amount = Number(entry.amount);
        receivablesData[monthKey].total += amount;
        receivablesData[monthKey].entries.push({
          id: entry.id,
          description: entry.description,
          amount,
          dueDate: entry.due_date,
          status: entry.payment_status,
          source: "financial",
        });
      });

      // Generate subscription entries for each active subscription (both paid and pending)
      // Reuse today and futureLimit from above

      (subscriptions || []).forEach(subscription => {
        const startDate = parseISO(subscription.start_date);
        const endDate = subscription.end_date ? parseISO(subscription.end_date) : futureLimit;
        const monthlyValue = Number(subscription.monthly_value);

        // Generate entries for each month the subscription is active
        let currentMonth = startOfMonth(startDate);
        
        while (isBefore(currentMonth, endDate) && isBefore(currentMonth, futureLimit)) {
          const month = currentMonth.getMonth() + 1;
          const year = currentMonth.getFullYear();
          const monthKey = format(currentMonth, "yyyy-MM");

          // Check if there's already a payment record for this month
          const existingPayment = (subscriptionPayments || []).find(
            p => p.subscription_id === subscription.id && p.month === month && p.year === year
          );

          // Include all subscription entries (paid and pending)
          if (!receivablesData[monthKey]) {
            receivablesData[monthKey] = { total: 0, entries: [] };
          }

          // Due date is last day of the month
          const paymentDate = endOfMonth(new Date(year, month - 1, 1));
          const paymentAmount = existingPayment ? Number(existingPayment.amount) : monthlyValue;
          const paymentStatus = existingPayment?.payment_status || "pending";
          
          receivablesData[monthKey].total += paymentAmount;
          receivablesData[monthKey].entries.push({
            id: existingPayment?.id || `sub-${subscription.id}-${monthKey}`,
            description: `📋 ${subscription.title}`,
            amount: paymentAmount,
            dueDate: format(paymentDate, "yyyy-MM-dd"),
            status: paymentStatus,
            source: "subscription",
            customerName: subscription.customer?.name,
          });

          currentMonth = addMonths(currentMonth, 1);
        }
      });

      // Sort by month (mostrar todos os meses com lançamentos)
      const sortedReceivables = Object.entries(receivablesData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, data]) => ({
          month,
          monthLabel: format(parseISO(month + "-01"), "MMMM 'de' yyyy", { locale: ptBR }),
          ...data,
        }));

      return {
        summary: {
          annualIncome,
          paidIncome,
          pendingIncome: pendingIncome + pendingSubscriptionTotal,
          pendingCurrentMonth: pendingCurrentMonthTotal,
          totalExpenses,
          paidExpenses,
          balance,
        },
        monthly: monthlyChartData,
        categories: categoryChartData,
        receivables: sortedReceivables,
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const summaryCards = [
    {
      title: "Receita Anual",
      value: data?.summary.annualIncome || 0,
      icon: TrendingUp,
      color: "text-accent",
      bgColor: "bg-gradient-to-br from-accent/20 to-accent/5",
      iconBg: "bg-accent/20",
    },
    {
      title: "A Receber (Mês Atual)",
      value: data?.summary.pendingCurrentMonth || 0,
      icon: ArrowUpRight,
      color: "text-amber-600",
      bgColor: "bg-gradient-to-br from-amber-500/15 to-amber-500/5",
      iconBg: "bg-amber-500/15",
    },
    {
      title: "A Receber",
      value: data?.summary.pendingIncome || 0,
      icon: DollarSign,
      color: "text-amber-600",
      bgColor: "bg-gradient-to-br from-amber-500/20 to-amber-500/5",
      iconBg: "bg-amber-500/20",
    },
    {
      title: "Despesas Total",
      value: data?.summary.totalExpenses || 0,
      icon: TrendingDown,
      color: "text-destructive",
      bgColor: "bg-gradient-to-br from-destructive/20 to-destructive/5",
      iconBg: "bg-destructive/20",
    },
    {
      title: "Despesas Pagas",
      value: data?.summary.paidExpenses || 0,
      icon: TrendingDown,
      color: "text-destructive",
      bgColor: "bg-gradient-to-br from-destructive/15 to-destructive/5",
      iconBg: "bg-destructive/15",
    },
    {
      title: "Saldo em Caixa",
      value: data?.summary.balance || 0,
      icon: Wallet,
      color: (data?.summary.balance || 0) >= 0 ? "text-accent" : "text-destructive",
      bgColor: (data?.summary.balance || 0) >= 0 
        ? "bg-gradient-to-br from-accent/20 to-accent/5" 
        : "bg-gradient-to-br from-destructive/20 to-destructive/5",
      iconBg: (data?.summary.balance || 0) >= 0 ? "bg-accent/20" : "bg-destructive/20",
    },
  ];

  return (
    <div className="space-y-6 overflow-x-hidden w-full max-w-full">
      {/* Widget Settings */}
      <div className="flex justify-end gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={toggleHideValues}
          className="gap-2"
          title={hideValues ? "Mostrar valores" : "Ocultar valores"}
        >
          {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {hideValues ? "Mostrar" : "Ocultar"}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Gerenciar widgets
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-4">
              <h4 className="font-medium">Widgets visíveis</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="summaryCards" 
                    checked={settings.showSummaryCards}
                    onCheckedChange={(checked) => saveSettings({ ...settings, showSummaryCards: !!checked })}
                  />
                  <Label htmlFor="summaryCards" className="text-sm">Cards de resumo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="categoryChart" 
                    checked={settings.showCategoryChart}
                    onCheckedChange={(checked) => saveSettings({ ...settings, showCategoryChart: !!checked })}
                  />
                  <Label htmlFor="categoryChart" className="text-sm">Despesas por categoria</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="monthlyReceivables" 
                    checked={settings.showMonthlyReceivables}
                    onCheckedChange={(checked) => saveSettings({ ...settings, showMonthlyReceivables: !!checked })}
                  />
                  <Label htmlFor="monthlyReceivables" className="text-sm">A receber por mês</Label>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary Cards */}
      {settings.showSummaryCards && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {summaryCards.map((card) => (
            <Card key={card.title} className={cn("shadow-card border-0 overflow-hidden", card.bgColor)}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={cn("p-2 rounded-full", card.iconBg)}>
                  <card.icon className={cn("h-4 w-4", card.color)} />
                </div>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <div className={cn("text-lg font-bold", card.color)}>
                  {formatValue(card.value, formatCurrency)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Chart */}
        {settings.showCategoryChart && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Despesas por Categoria</CardTitle>
              <CardDescription>Distribuição das despesas</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.categories && data.categories.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.categories}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {data.categories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => formatCurrency(Number(value))}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
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
        )}

        {/* Monthly Receivables */}
        {settings.showMonthlyReceivables && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>A Receber por Mês</CardTitle>
              <CardDescription>Previsão de recebimentos futuros</CardDescription>
            </CardHeader>
            <CardContent className="overflow-hidden max-w-full">
              {monthlyReceivables && monthlyReceivables.length > 0 ? (
                <div className="space-y-3 overflow-hidden max-w-full w-full">
                  {(showAllReceivables ? monthlyReceivables : monthlyReceivables.slice(0, 4)).map((item) => (
                    <Collapsible key={item.month}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                          <div>
                            <p className="font-medium capitalize">{item.monthLabel}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.entries.length} {item.entries.length === 1 ? "lançamento" : "lançamentos"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-600">{formatCurrency(item.total)}</span>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 overflow-hidden max-w-full w-full">
                        {/* Mobile list (igual ao print) */}
                        <div className="md:hidden overflow-hidden max-w-full w-full">
                          <div className="border rounded-lg bg-background overflow-hidden divide-y w-full max-w-full">
                            {item.entries.map((entry: any) => (
                              <div key={entry.id} className="px-3 py-2.5 overflow-hidden w-full box-border" style={{ maxWidth: '100%' }}>
                                {/* Grid para forçar largura correta */}
                                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 w-full overflow-hidden">
                                  {/* Status indicator */}
                                  <div className="flex-shrink-0">
                                    {entry.status === "paid" && (
                                      <span className="w-2.5 h-2.5 rounded-full bg-success inline-block" title="Pago" />
                                    )}
                                    {entry.status === "pending" && (
                                      <span className="w-2.5 h-2.5 rounded-full bg-warning inline-block" title="Pendente" />
                                    )}
                                    {entry.status === "partial" && (
                                      <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" title="Parcial" />
                                    )}
                                  </div>
                                  
                                  {/* Descrição - trunca corretamente */}
                                  <p className="font-bold text-xs truncate overflow-hidden">
                                    {entry.description}
                                  </p>
                                  
                                  {/* Valor - nunca encolhe */}
                                  <span
                                    className={cn(
                                      "font-semibold text-xs whitespace-nowrap",
                                      entry.status === "paid" ? "text-success" : "text-warning"
                                    )}
                                  >
                                    {formatCurrency(entry.amount)}
                                  </span>
                                </div>

                                {entry.customerName && (
                                  <p className="mt-1 text-[10px] text-muted-foreground truncate overflow-hidden w-full block">
                                    {entry.customerName}
                                  </p>
                                )}

                                <p className="mt-0.5 text-[10px] text-muted-foreground">
                                  Venc: {format(parseISO(entry.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                                </p>

                                <p
                                  className={cn(
                                    "mt-0.5 text-[10px]",
                                    entry.status === "paid"
                                      ? "text-success"
                                      : entry.status === "partial"
                                        ? "text-muted-foreground"
                                        : "text-warning"
                                  )}
                                >
                                  {entry.status === "paid" ? "Recebido" : entry.status === "partial" ? "Parcial" : "Pendente"}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Desktop mantém o layout anterior */}
                        <div className="hidden md:block mt-2 space-y-2 pl-4">
                          {item.entries.map((entry: any) => (
                            <div key={entry.id} className="flex items-center justify-between p-3 bg-background rounded-lg border text-sm hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {entry.status === "paid" && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-accent flex-shrink-0" title="Pago" />
                                )}
                                {entry.status === "pending" && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" title="Pendente" />
                                )}
                                {entry.status === "partial" && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" title="Parcial" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium truncate">{entry.description}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {entry.customerName && <span>{entry.customerName} • </span>}
                                    Venc: {format(parseISO(entry.dueDate), "dd/MM/yyyy", { locale: ptBR })} •
                                    {entry.status === "paid" ? " Recebido" : entry.status === "partial" ? " Parcial" : " Pendente"}
                                  </p>
                                </div>
                              </div>
                              <span className={cn(
                                "font-semibold text-right ml-2",
                                entry.status === "paid" ? "text-accent" : "text-amber-600"
                              )}>
                                {formatCurrency(entry.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                  
                  {monthlyReceivables.length > 4 && (
                    <Button 
                      variant="ghost" 
                      className="w-full mt-2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAllReceivables(!showAllReceivables)}
                    >
                      {showAllReceivables ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          Mostrar menos
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          Ver mais {monthlyReceivables.length - 4} meses
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Nenhum recebimento agendado
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
