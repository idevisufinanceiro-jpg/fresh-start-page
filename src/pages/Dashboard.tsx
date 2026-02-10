import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  DollarSign, 
  Users, 
  FileText, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  ShoppingCart,
  ClipboardList,
  Clock,
  ArrowRight,
  ChevronRight,
  Target,
  Eye,
  EyeOff,
  Info
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInDays, isBefore, isToday, addMonths, parseISO, startOfMonth, startOfYear, endOfYear, eachMonthOfInterval, isWithinInterval, endOfMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useHideValues } from "@/hooks/useHideValues";
import { BreakEvenModal } from "@/components/dashboard/BreakEvenModal";
import { Progress } from "@/components/ui/progress";
import { useFinancialRealtime } from "@/hooks/useFinancialRealtime";
import { DashboardSkeleton, MobileDashboardSkeleton } from "@/components/ui/page-skeleton";
import { useMonthlyReceivables } from "@/hooks/useMonthlyReceivables";

export default function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { hideValues, toggleHideValues, formatValue } = useHideValues();
  const [breakEvenModalOpen, setBreakEvenModalOpen] = useState(false);

  // Realtime: atualiza dashboard quando dados financeiros mudam
  useFinancialRealtime();
  
  // Dados de "A Receber por Mês" centralizados
  const { data: monthlyReceivables } = useMonthlyReceivables();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    staleTime: 30 * 1000, // 30 segundos - atualiza mais rápido
    gcTime: 5 * 60 * 1000, // 5 minutos - mantém em cache
    refetchOnWindowFocus: true, // Atualiza ao voltar para a aba
    queryFn: async () => {
      const [customersRes, quotesRes, salesRes, financialRes, eventsRes, subscriptionsRes, subPaymentsRes] = await Promise.all([
        supabase.from("customers").select("*", { count: "exact" }),
        supabase.from("quotes").select("*"),
        supabase.from("sales").select("*, customers(name)"),
        supabase.from("financial_entries").select("*"),
        supabase.from("calendar_events").select("*"),
        supabase.from("subscriptions").select("*").eq("is_active", true),
        supabase.from("subscription_payments").select("*"),
      ]);

      const customers = customersRes.data || [];
      const quotes = quotesRes.data || [];
      const sales = salesRes.data || [];
      const financial = financialRes.data || [];
      const events = eventsRes.data || [];
      const subscriptions = subscriptionsRes.data || [];
      const subscriptionPayments = subPaymentsRes.data || [];

      const pendingQuotes = quotes.filter(q => q.status === "sent" || q.status === "draft");
      const approvedQuotes = quotes.filter(q => q.status === "approved");

      // Get IDs of financial entries that come from subscription payments (to avoid duplication)
      const subscriptionFinancialEntryIds = new Set(
        subscriptionPayments
          .filter((p: any) => p.financial_entry_id)
          .map((p: any) => p.financial_entry_id)
      );

      // Exclude income entries that come from subscriptions (to avoid duplication)
      const income = financial.filter(f => f.type === "income" && !subscriptionFinancialEntryIds.has(f.id));
      const expenses = financial.filter(f => f.type === "expense");

      // Calculate paid subscription income
      const paidSubscriptionIncome = subscriptionPayments
        .filter((p: any) => p.payment_status === "paid")
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      
      // Total revenue - receitas PAGAS (financial entries + subscription payments)
      const paidIncomeFromFinancial = income.filter(f => f.payment_status === "paid");
      const totalRevenueFromFinancial = paidIncomeFromFinancial.reduce((sum, entry) => sum + Number(entry.amount), 0);
      const totalRevenue = totalRevenueFromFinancial + paidSubscriptionIncome;
      
      // Total expenses - todas as despesas
      const totalExpenses = expenses.reduce((sum, entry) => sum + Number(entry.amount), 0);
      
      // Despesas pagas
      const paidExpenses = expenses
        .filter(f => f.payment_status === "paid")
        .reduce((sum, e) => sum + Number(e.amount), 0);
      
      // Total pending (a receber) - usando mesma lógica do financeiro
      const pendingIncomeFromFinancial = income
        .filter(f => f.payment_status === "pending" || f.payment_status === "partial")
        .reduce((sum, e) => sum + Number(e.remaining_amount || e.amount), 0);

      // Calculate pending subscription total (same logic as FinancialDashboard)
      let pendingSubscriptionTotal = 0;
      const today = new Date();
      const futureLimit = addMonths(today, 12);
      
      subscriptions.forEach((subscription: any) => {
        const startDate = parseISO(subscription.start_date);
        const endDate = subscription.end_date ? parseISO(subscription.end_date) : futureLimit;
        const monthlyValue = Number(subscription.monthly_value);

        let currentMonth = startOfMonth(startDate);
        
        while (isBefore(currentMonth, endDate) && isBefore(currentMonth, futureLimit)) {
          const month = currentMonth.getMonth() + 1;
          const year = currentMonth.getFullYear();

          const existingPayment = subscriptionPayments.find(
            (p: any) => p.subscription_id === subscription.id && p.month === month && p.year === year
          );

          // Add to pending if no payment exists or payment is pending
          if (!existingPayment || existingPayment.payment_status === "pending") {
            pendingSubscriptionTotal += monthlyValue;
          }

          currentMonth = addMonths(currentMonth, 1);
        }
      });

      const pendingIncomeTotal = pendingIncomeFromFinancial + pendingSubscriptionTotal;

      // Pending payments list (apenas para exibição - top 5)
      const pendingPayments = income
        .filter(f => (f.payment_status === "pending" || f.payment_status === "partial") && f.due_date)
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
        .slice(0, 5);

      // Current month receivables data (for "A Receber por Mês" section)
      // Mesma lógica do quadro "A Receber por Mês" do Financeiro:
      // - agrupa por mês do due_date
      // - soma o valor cheio (amount), independente do status
      // - inclui mensalidades de assinaturas
      // - EXCLUI financial_entries que vieram de subscription_payments (evita duplicação)
      const currentMonthKey = format(today, "yyyy-MM");
      const currentMonthLabel = format(today, "MMMM 'De' yyyy", { locale: ptBR });

      // Financial entries (independente do status, income já exclui os de assinatura)
      const currentMonthEntries: { id: string; description: string; amount: number; status: string }[] = income
        .filter(entry => {
          if (!entry.due_date) return false;
          const entryDueDate = parseISO(entry.due_date);
          return format(entryDueDate, "yyyy-MM") === currentMonthKey;
        })
        .map(entry => ({
          id: entry.id,
          description: entry.description,
          amount: Number(entry.amount),
          status: entry.payment_status || "pending",
        }));

      // Subscriptions (inclui pagas e pendentes, como no Financeiro)
      const thisMonthNum = today.getMonth() + 1;
      const thisYearNum = today.getFullYear();

      subscriptions.forEach((subscription: any) => {
        const subStartDate = parseISO(subscription.start_date);
        const subEndDate = subscription.end_date ? parseISO(subscription.end_date) : futureLimit;

        // Check if subscription is active in current month
        if (isBefore(subStartDate, addMonths(today, 1)) && isBefore(today, subEndDate)) {
          const existingPayment = subscriptionPayments.find(
            (p: any) => p.subscription_id === subscription.id && p.month === thisMonthNum && p.year === thisYearNum
          );

          currentMonthEntries.push({
            id: existingPayment?.id || `sub-${subscription.id}-${currentMonthKey}`,
            description: `📋 ${subscription.title}`,
            amount: existingPayment ? Number(existingPayment.amount) : Number(subscription.monthly_value),
            status: existingPayment?.payment_status || "pending",
          });
        }
      });

      const currentMonthTotal = currentMonthEntries.reduce((sum, e) => sum + e.amount, 0);
      const currentMonthCount = currentMonthEntries.length;

      // Monthly revenue
      const monthlyRevenue = income.reduce((acc, entry) => {
        const month = format(new Date(entry.created_at), 'MMM', { locale: ptBR });
        const existing = acc.find(item => item.month === month);
        if (existing) {
          existing.value += Number(entry.amount);
        } else {
          acc.push({ month, value: Number(entry.amount) });
        }
        return acc;
      }, [] as { month: string; value: number }[]);

      // Quote status data
      const quoteStatusData = [
        { name: "Rascunho", value: quotes.filter(q => q.status === "draft").length, color: "hsl(var(--muted-foreground))" },
        { name: "Enviados", value: quotes.filter(q => q.status === "sent").length, color: "hsl(var(--primary))" },
        { name: "Aprovados", value: approvedQuotes.length, color: "#22c55e" },
        { name: "Cancelados", value: quotes.filter(q => q.status === "cancelled").length, color: "hsl(var(--destructive))" },
      ].filter(item => item.value > 0);

      // Upcoming deliveries from sales
      const upcomingDeliveries = sales
        .filter(s => (s as any).delivery_date && isBefore(new Date(), new Date((s as any).delivery_date)))
        .map(s => ({
          id: s.id,
          title: s.title,
          customer: s.customers?.name,
          date: (s as any).delivery_date,
          daysLeft: differenceInDays(new Date((s as any).delivery_date), new Date()),
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 5);

      // Upcoming events
      const upcomingEvents = events
        .filter(e => isBefore(new Date(), new Date(e.start_time)) || isToday(new Date(e.start_time)))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 5);

      // Calculate monthly break-even data for the year
      const currentYear = getYear(new Date());
      const yearStart = startOfYear(new Date());
      const yearEnd = endOfYear(new Date());
      const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
      
      const monthlyBreakEven = months.map(monthDate => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const monthKey = format(monthDate, "yyyy-MM");
        const monthLabel = format(monthDate, "MMM", { locale: ptBR });
        const monthNum = monthDate.getMonth() + 1;
        const yearNum = monthDate.getFullYear();
        
        // Calculate income for this month from financial entries
        const monthIncomeFromFinancial = income
          .filter(e => {
            const entryDate = e.paid_at ? parseISO(e.paid_at) : new Date(e.created_at);
            return e.payment_status === "paid" && isWithinInterval(entryDate, { start: monthStart, end: monthEnd });
          })
          .reduce((sum, e) => sum + Number(e.amount), 0);
        
        // Calculate paid subscription income for this month
        const monthSubscriptionIncome = subscriptionPayments
          .filter((p: any) => p.payment_status === "paid" && p.month === monthNum && p.year === yearNum)
          .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        
        // Total month income
        const monthIncome = monthIncomeFromFinancial + monthSubscriptionIncome;
        
        // Calculate expenses for this month
        const monthExpenses = expenses
          .filter(e => {
            const entryDate = e.paid_at ? parseISO(e.paid_at) : new Date(e.created_at);
            return e.payment_status === "paid" && isWithinInterval(entryDate, { start: monthStart, end: monthEnd });
          })
          .reduce((sum, e) => sum + Number(e.amount), 0);
        
        const progress = monthExpenses > 0 ? (monthIncome / monthExpenses) * 100 : (monthIncome > 0 ? 200 : 0);
        const surplus = monthIncome - monthExpenses;
        
        return {
          month: monthKey,
          monthLabel,
          income: monthIncome,
          expenses: monthExpenses,
          progress,
          surplus,
        };
      });

      // Current month break-even
      const currentMonthData = monthlyBreakEven.find(m => m.month === format(new Date(), "yyyy-MM"));
      const currentBreakEvenProgress = currentMonthData?.progress || 0;

      return {
        totalCustomers: customersRes.count || 0,
        pendingQuotes: pendingQuotes.length,
        totalSales: sales.length,
        totalRevenue,
        totalExpenses,
        profit: totalRevenue - paidExpenses,
        pendingPayments,
        monthlyRevenue,
        quoteStatusData,
        upcomingDeliveries,
        upcomingEvents,
        pendingPaymentsTotal: pendingIncomeTotal,
        currentMonthReceivables: {
          monthLabel: currentMonthLabel,
          total: currentMonthTotal,
          count: currentMonthCount,
        },
        monthlyBreakEven,
        currentBreakEvenProgress,
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}k`;
    }
    return formatCurrency(value);
  };

  // Loading state
  if (isLoading) {
    return isMobile ? <MobileDashboardSkeleton /> : <DashboardSkeleton />;
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="space-y-4 animate-in fade-in duration-500 overflow-x-hidden w-full max-w-full">
        {/* Break-even Modal */}
        <BreakEvenModal 
          open={breakEvenModalOpen}
          onOpenChange={setBreakEvenModalOpen}
          monthlyData={stats?.monthlyBreakEven || []}
          hideValues={hideValues}
          formatCurrency={formatCurrency}
        />

        {/* Header with hide button */}
        <div className="flex items-center justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleHideValues}
            className="gap-2"
          >
            {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>

        {/* Stats Grid - Mobile */}
        <div className="grid grid-cols-2 gap-3">
          <div 
            className="mobile-card cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate("/financial")}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Faturamento</p>
                <p className="text-lg font-bold">{formatValue(stats?.totalRevenue || 0, formatCurrencyShort)}</p>
              </div>
            </div>
          </div>

          <div 
            className="mobile-card cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate("/financial")}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">A Receber</p>
                <p className="text-lg font-bold">{formatValue(stats?.pendingPaymentsTotal || 0, formatCurrencyShort)}</p>
              </div>
            </div>
          </div>

          <div 
            className="mobile-card cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate("/sales")}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Vendas</p>
                <p className="text-lg font-bold">{hideValues ? "••••" : stats?.totalSales || 0}</p>
              </div>
            </div>
          </div>

          <div 
            className="mobile-card cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate("/customers")}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Clientes</p>
                <p className="text-lg font-bold">{hideValues ? "••••" : stats?.totalCustomers || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Break-even Card - Mobile */}
        <div 
          className="mobile-card cursor-pointer active:scale-[0.98] transition-transform"
          onClick={() => setBreakEvenModalOpen(true)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                (stats?.currentBreakEvenProgress || 0) >= 100 
                  ? "bg-success/10" 
                  : "bg-warning/10"
              )}>
                <Target className={cn(
                  "h-5 w-5",
                  (stats?.currentBreakEvenProgress || 0) >= 100 
                    ? "text-success" 
                    : "text-warning"
                )} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ponto de Equilíbrio</p>
                <p className={cn(
                  "text-lg font-bold",
                  (stats?.currentBreakEvenProgress || 0) >= 100 
                    ? "text-success" 
                    : "text-warning"
                )}>
                  {hideValues ? "••••" : `${(stats?.currentBreakEvenProgress || 0).toFixed(0)}%`}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <Progress 
            value={Math.min(stats?.currentBreakEvenProgress || 0, 100)} 
            className={cn(
              "h-2",
              (stats?.currentBreakEvenProgress || 0) >= 100 
                ? "[&>div]:bg-success" 
                : "[&>div]:bg-warning"
            )}
          />
        </div>

        {/* Upcoming Deliveries - Mobile */}
        <div className="mobile-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="mobile-section-title flex items-center gap-2 mb-0">
              <ClipboardList className="h-4 w-4 text-primary" />
              Próximas Entregas
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-8 px-2"
              onClick={() => navigate("/sales")}
            >
              Ver todas
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          
          {stats?.upcomingDeliveries && stats.upcomingDeliveries.length > 0 ? (
            <div className="space-y-2">
              {stats.upcomingDeliveries.slice(0, 3).map((delivery) => (
                <div 
                  key={delivery.id} 
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate(`/calendar?date=${delivery.date}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{delivery.title}</p>
                    {delivery.customer && (
                      <p className="text-xs text-muted-foreground truncate">{delivery.customer}</p>
                    )}
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-xs font-medium">
                      {format(new Date(delivery.date), "dd/MM", { locale: ptBR })}
                    </p>
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full inline-block",
                      delivery.daysLeft <= 3 
                        ? 'bg-destructive/10 text-destructive' 
                        : delivery.daysLeft <= 7 
                          ? 'bg-yellow-500/10 text-yellow-600' 
                          : 'bg-primary/10 text-primary'
                    )}>
                      {delivery.daysLeft === 0 ? 'Hoje' : `${delivery.daysLeft}d`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6 text-sm">Nenhuma entrega programada</p>
          )}
        </div>

        {/* Pending Payments - Mobile */}
        <div className="mobile-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="mobile-section-title flex items-center gap-2 mb-0">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Contas a Receber
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-8 px-2"
              onClick={() => navigate("/financial")}
            >
              Ver todas
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          
          {stats?.pendingPayments && stats.pendingPayments.length > 0 ? (
            <div className="space-y-2">
              {stats.pendingPayments.slice(0, 3).map((payment) => {
                const daysUntil = differenceInDays(new Date(payment.due_date!), new Date());
                const isOverdue = daysUntil < 0;
                return (
                  <div 
                    key={payment.id} 
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => {
                      if (payment.sale_id) {
                        navigate(`/sales?view=${payment.sale_id}`);
                      } else {
                        navigate("/financial");
                      }
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{payment.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(payment.due_date!), "dd/MM", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="font-bold text-sm text-primary">
                        {formatCurrencyShort(Number(payment.amount))}
                      </p>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full inline-block",
                        isOverdue 
                          ? 'bg-destructive/10 text-destructive' 
                          : daysUntil <= 3 
                            ? 'bg-yellow-500/10 text-yellow-600' 
                            : 'bg-muted text-muted-foreground'
                      )}>
                        {isOverdue ? `${Math.abs(daysUntil)}d atraso` : daysUntil === 0 ? 'Hoje' : `${daysUntil}d`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6 text-sm">Nenhum pagamento pendente</p>
          )}
        </div>

        {/* Upcoming Events - Mobile */}
        {stats?.upcomingEvents && stats.upcomingEvents.length > 0 && (
          <div className="mobile-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="mobile-section-title flex items-center gap-2 mb-0">
                <Calendar className="h-4 w-4 text-primary" />
                Próximos Eventos
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-8 px-2"
                onClick={() => navigate("/calendar")}
              >
                Ver agenda
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {stats.upcomingEvents.slice(0, 3).map((event) => (
                <div 
                  key={event.id} 
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
                >
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: event.color || '#ff005c' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.start_time), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop Layout
  const quickActions = [
    {
      title: "Novo Orçamento",
      icon: FileText,
      onClick: () => navigate("/quotes"),
      color: "bg-primary",
    },
    {
      title: "Nova Venda",
      icon: ShoppingCart,
      onClick: () => navigate("/sales"),
      color: "bg-accent",
    },
    {
      title: "Novo Cliente",
      icon: Users,
      onClick: () => navigate("/customers"),
      color: "bg-primary",
    },
    {
      title: "Agenda",
      icon: Calendar,
      onClick: () => navigate("/calendar"),
      color: "bg-accent",
    },
  ];

  const breakEvenProgress = stats?.currentBreakEvenProgress || 0;
  const currentMonthKey = format(new Date(), "yyyy-MM");
  const currentMonthData = stats?.monthlyBreakEven?.find((m: any) => m.month === currentMonthKey);

  const currentMonthName = format(new Date(), "MMMM", { locale: ptBR });
  const currentYear = getYear(new Date());
  
  // Dados de "A Receber por Mês" do hook centralizado
  const currentMonthReceivablesData = monthlyReceivables?.find(m => m.month === currentMonthKey);
  const currentMonthReceivables = currentMonthReceivablesData ? {
    monthLabel: currentMonthReceivablesData.monthLabel,
    total: currentMonthReceivablesData.total,
    count: currentMonthReceivablesData.entries.length,
  } : null;

  const statsCards = [
    {
      title: "Faturamento Total",
      value: stats?.totalRevenue || 0,
      displayValue: formatValue(stats?.totalRevenue || 0, formatCurrency),
      icon: DollarSign,
      gradient: "bg-gradient-to-br from-success to-success/70",
      iconBg: "bg-success/10",
      iconColor: "text-success",
      tooltip: `Soma de todas as receitas PAGAS registradas no sistema. Inclui vendas, serviços e outras entradas financeiras que já foram confirmadas como recebidas.`,
    },
    {
      title: "A Receber",
      value: stats?.pendingPaymentsTotal || 0,
      displayValue: formatValue(stats?.pendingPaymentsTotal || 0, formatCurrency),
      icon: Clock,
      gradient: "bg-gradient-to-br from-amber-500 to-amber-500/70",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
      onClick: () => navigate("/financial"),
      tooltip: `Total de receitas PENDENTES ou PARCIAIS. Inclui lançamentos financeiros com status pendente e mensalidades de assinaturas não pagas dos próximos 12 meses.`,
    },
    {
      title: "Lucro",
      value: stats?.profit || 0,
      displayValue: formatValue(stats?.profit || 0, formatCurrency),
      icon: TrendingUp,
      gradient: "bg-gradient-to-br from-primary to-primary/70",
      iconBg: (stats?.profit || 0) >= 0 ? "bg-primary/10" : "bg-destructive/10",
      iconColor: (stats?.profit || 0) >= 0 ? "text-primary" : "text-destructive",
      tooltip: `Lucro = Faturamento Total - Despesas Pagas. Representa o resultado financeiro líquido considerando apenas valores já efetivados.`,
    },
    {
      title: "Vendas",
      value: stats?.totalSales || 0,
      displayValue: hideValues ? "••••" : String(stats?.totalSales || 0),
      icon: ShoppingCart,
      gradient: "bg-gradient-to-br from-accent to-accent/70",
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
      onClick: () => navigate("/sales"),
      tooltip: `Quantidade total de vendas registradas no sistema, independente do status de pagamento.`,
    },
    {
      title: "Orçamentos",
      value: stats?.pendingQuotes || 0,
      displayValue: hideValues ? "••••" : String(stats?.pendingQuotes || 0),
      icon: FileText,
      gradient: "bg-gradient-to-br from-primary to-primary/70",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      onClick: () => navigate("/quotes"),
      tooltip: `Quantidade de orçamentos com status "Rascunho" ou "Enviado" aguardando aprovação do cliente.`,
    },
    {
      title: "Clientes",
      value: stats?.totalCustomers || 0,
      displayValue: hideValues ? "••••" : String(stats?.totalCustomers || 0),
      icon: Users,
      gradient: "bg-gradient-to-br from-accent to-accent/70",
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
      onClick: () => navigate("/customers"),
      tooltip: `Total de clientes cadastrados na sua base de dados.`,
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Break-even Modal */}
      <BreakEvenModal 
        open={breakEvenModalOpen}
        onOpenChange={setBreakEvenModalOpen}
        monthlyData={stats?.monthlyBreakEven || []}
        hideValues={hideValues}
        formatCurrency={formatCurrency}
      />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h2>
            <p className="text-muted-foreground text-sm md:text-base mt-1">Visão geral do seu negócio</p>
          </div>
          
          {/* Hide Values Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleHideValues}
            className="gap-2"
            title={hideValues ? "Mostrar valores" : "Ocultar valores"}
          >
            {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="hidden sm:inline">{hideValues ? "Mostrar" : "Ocultar"}</span>
          </Button>
        </div>
        
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.title}
              onClick={action.onClick}
              variant="outline"
              size="sm"
              className="gap-2 text-xs md:text-sm"
            >
              <action.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{action.title}</span>
              <span className="sm:hidden">{action.title.split(' ')[0]}</span>
            </Button>
          ))}
        </div>
      </div>

      <TooltipProvider delayDuration={300}>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {statsCards.map((stat, index) => (
            <Card 
              key={stat.title}
              className={cn(
                "relative shadow-card hover:shadow-elevated transition-all duration-300 border-0 overflow-visible",
                stat.onClick && "cursor-pointer hover:scale-[1.02]"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={stat.onClick}
            >
              <div className={cn("absolute inset-0 opacity-5 rounded-lg", stat.gradient)} />
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 relative overflow-visible">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                    {stat.title}
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px] text-xs z-50">
                      <p>{stat.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={cn("p-2 rounded-xl flex-shrink-0", stat.iconBg)}>
                  <stat.icon className={cn("h-4 w-4", stat.iconColor)} />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 relative">
                <div className="text-lg md:text-xl font-bold truncate">{stat.displayValue}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </TooltipProvider>

      <TooltipProvider delayDuration={300}>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Break-even Card */}
          <Card 
            className="relative overflow-hidden shadow-card hover:shadow-elevated transition-all cursor-pointer border-0"
            onClick={() => setBreakEvenModalOpen(true)}
          >
            <div className={cn(
              "absolute inset-0 opacity-5",
              breakEvenProgress >= 100 
                ? "bg-gradient-to-br from-success via-success/50 to-transparent" 
                : breakEvenProgress >= 75 
                  ? "bg-gradient-to-br from-warning via-warning/50 to-transparent"
                  : "bg-gradient-to-br from-destructive via-destructive/50 to-transparent"
            )} />
            
            <CardHeader className="pb-2 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-xl",
                    breakEvenProgress >= 100 
                      ? "bg-success/10" 
                      : breakEvenProgress >= 75 
                        ? "bg-warning/10"
                        : "bg-destructive/10"
                  )}>
                    <Target className={cn(
                      "h-5 w-5",
                      breakEvenProgress >= 100 
                        ? "text-success" 
                        : breakEvenProgress >= 75 
                          ? "text-warning"
                          : "text-destructive"
                    )} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <CardTitle className="text-base">Ponto de Equilíbrio</CardTitle>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px] text-xs">
                          <p>
                            <strong>Ponto de Equilíbrio</strong> indica quando suas receitas cobrem 100% das despesas do mês atual ({currentMonthName}).
                            Acima de 100% = lucro. Abaixo = as despesas superaram as receitas.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-3xl font-bold",
                    breakEvenProgress >= 100 
                      ? "text-success" 
                      : breakEvenProgress >= 75 
                        ? "text-warning"
                        : "text-destructive"
                  )}>
                    {hideValues ? "••••" : `${breakEvenProgress.toFixed(0)}%`}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {breakEvenProgress >= 100 ? "Meta atingida" : "Em progresso"}
                  </p>
                </div>
              </div>
            </CardHeader>
          
          <CardContent className="relative space-y-4">
            {/* Progress bar with milestone markers */}
            <div className="space-y-2">
              <div className="relative">
                <Progress 
                  value={Math.min(breakEvenProgress, 100)} 
                  className={cn(
                    "h-4",
                    breakEvenProgress >= 100 
                      ? "[&>div]:bg-success" 
                      : breakEvenProgress >= 75 
                        ? "[&>div]:bg-warning"
                        : "[&>div]:bg-destructive"
                  )}
                />
                {/* Milestone markers */}
                <div className="absolute top-0 left-1/4 w-px h-4 bg-border/50" />
                <div className="absolute top-0 left-1/2 w-px h-4 bg-border/50" />
                <div className="absolute top-0 left-3/4 w-px h-4 bg-border/50" />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Status explanation */}
            <div className={cn(
              "p-3 rounded-lg border",
              breakEvenProgress >= 100 
                ? "bg-success/5 border-success/20" 
                : breakEvenProgress >= 75 
                  ? "bg-warning/5 border-warning/20"
                  : "bg-destructive/5 border-destructive/20"
            )}>
              {breakEvenProgress >= 100 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="text-sm font-medium text-success">Meta Atingida!</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Suas receitas superaram suas despesas em{" "}
                    <span className="font-semibold text-success">
                      {formatValue(currentMonthData?.surplus || 0, formatCurrency)}
                    </span>
                    . Você está{" "}
                    <span className="font-semibold text-success">
                      {hideValues ? "••••" : `${(breakEvenProgress - 100).toFixed(0)}%`}
                    </span>{" "}
                    acima do ponto de equilíbrio.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full animate-pulse",
                      breakEvenProgress >= 75 ? "bg-warning" : "bg-destructive"
                    )} />
                    <span className={cn(
                      "text-sm font-medium",
                      breakEvenProgress >= 75 ? "text-warning" : "text-destructive"
                    )}>
                      {breakEvenProgress >= 75 ? "Quase lá!" : "Atenção Necessária"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Faltam{" "}
                    <span className={cn(
                      "font-semibold",
                      breakEvenProgress >= 75 ? "text-warning" : "text-destructive"
                    )}>
                      {formatValue(Math.abs(currentMonthData?.surplus || 0), formatCurrency)}
                    </span>{" "}
                    em receitas para cobrir suas despesas no mês.
                  </p>
                </div>
              )}
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-destructive" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Despesas Totais</p>
                </div>
                <p className="text-base font-bold text-destructive">
                  {formatValue(currentMonthData?.expenses || 0, formatCurrency)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-success" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Receitas Totais</p>
                </div>
                <p className="text-base font-bold text-success">
                  {formatValue(currentMonthData?.income || 0, formatCurrency)}
                </p>
              </div>
            </div>

            {/* What's needed section - only show if below break-even */}
            {breakEvenProgress < 100 && (
              <div className="pt-3 border-t space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">O que falta para equilibrar:</p>
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <span className="text-xs text-muted-foreground">Valor necessário</span>
                  <span className="text-sm font-semibold">{formatValue(Math.abs(currentMonthData?.surplus || 0), formatCurrency)}</span>
                </div>
              </div>
            )}

            {/* Click hint */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span>Clique para ver todos os meses</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          </CardContent>
        </Card>

          {/* A Receber por Mês */}
          <Card className="shadow-card border-0">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10">
                  <DollarSign className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <CardTitle className="text-base">A Receber por Mês</CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[280px] text-xs">
                        <p>
                          Soma de todos os lançamentos com vencimento no mês atual ({currentMonthName}), 
                          incluindo receitas financeiras e mensalidades de assinaturas.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Previsão de recebimentos</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/5 to-transparent rounded-xl cursor-pointer hover:from-amber-500/10 transition-colors border border-amber-500/10"
                onClick={() => navigate("/financial")}
              >
                <div>
                  <p className="font-semibold text-foreground capitalize">
                    {currentMonthReceivables?.monthLabel || format(new Date(), "MMMM 'De' yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {hideValues ? "••" : currentMonthReceivables?.count || 0} lançamentos
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-600">
                    {formatValue(currentMonthReceivables?.total || 0, formatCurrency)}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <span>Ver detalhes</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Deliveries */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Próximas Entregas
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/sales")}>
              Ver todas <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {stats?.upcomingDeliveries && stats.upcomingDeliveries.length > 0 ? (
              <div className="space-y-3">
                {stats.upcomingDeliveries.map((delivery) => (
                  <div 
                    key={delivery.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(`/calendar?date=${delivery.date}`)}
                  >
                    <div>
                      <p className="font-medium">{delivery.title}</p>
                      {delivery.customer && (
                        <p className="text-sm text-muted-foreground">{delivery.customer}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {format(new Date(delivery.date), "dd/MM", { locale: ptBR })}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        delivery.daysLeft <= 3 
                          ? 'bg-destructive/10 text-destructive' 
                          : delivery.daysLeft <= 7 
                            ? 'bg-yellow-500/10 text-yellow-600' 
                            : 'bg-primary/10 text-primary'
                      }`}>
                        {delivery.daysLeft === 0 ? 'Hoje' : `${delivery.daysLeft} dias`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Nenhuma entrega programada</p>
            )}
          </CardContent>
        </Card>

        {/* Pending Payments */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Contas a Receber
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/financial")}>
              Ver todas <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {stats?.pendingPayments && stats.pendingPayments.length > 0 ? (
              <div className="space-y-3">
                {stats.pendingPayments.map((payment) => {
                  const daysUntil = differenceInDays(new Date(payment.due_date!), new Date());
                  const isOverdue = daysUntil < 0;
                  return (
                    <div 
                      key={payment.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => {
                        if (payment.sale_id) {
                          navigate(`/sales?view=${payment.sale_id}`);
                        } else {
                          navigate("/financial");
                        }
                      }}
                    >
                      <div>
                        <p className="font-medium text-sm">{payment.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Vence: {format(new Date(payment.due_date!), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{formatCurrency(Number(payment.amount))}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          isOverdue 
                            ? 'bg-destructive/10 text-destructive' 
                            : daysUntil <= 3 
                              ? 'bg-yellow-500/10 text-yellow-600' 
                              : 'bg-muted text-muted-foreground'
                        }`}>
                          {isOverdue ? `${Math.abs(daysUntil)} dias atraso` : daysUntil === 0 ? 'Hoje' : `${daysUntil} dias`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Nenhum pagamento pendente</p>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Upcoming Events */}
      {stats?.upcomingEvents && stats.upcomingEvents.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Próximos Eventos
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/calendar")}>
              Ver agenda <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {stats.upcomingEvents.map((event) => (
                <div 
                  key={event.id} 
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: event.color || '#ff005c' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.start_time), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
