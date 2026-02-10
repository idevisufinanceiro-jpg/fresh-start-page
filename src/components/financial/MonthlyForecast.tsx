import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, ChevronRight, ChevronDown } from "lucide-react";
import { format, startOfMonth, addMonths, isSameMonth, parseISO, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useFinancialRealtime } from "@/hooks/useFinancialRealtime";

interface ForecastEntry {
  id: string;
  description: string;
  amount: number;
  remaining_amount?: number;
  due_date: string;
  payment_status: string | null;
  customer?: { name: string } | null;
  source: "financial" | "subscription";
}

interface MonthlyData {
  month: Date;
  label: string;
  total: number;
  entries: ForecastEntry[];
}

export function MonthlyForecast() {
  // Realtime updates
  useFinancialRealtime();
  
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const { data: forecastData, isLoading } = useQuery({
    queryKey: ["monthly-forecast"],
    queryFn: async () => {
      // Fetch pending and partial financial entries (not paid)
      const { data: entries, error: entriesError } = await supabase
        .from("financial_entries")
        .select("id, description, amount, remaining_amount, original_amount, due_date, payment_status, customer:customers(name)")
        .eq("type", "income")
        .in("payment_status", ["pending", "partial"])
        .not("due_date", "is", null)
        .order("due_date");

      if (entriesError) throw entriesError;

      // Fetch subscription payments (to check which are already paid or skipped)
      const { data: subscriptionPayments, error: subPaymentsError } = await supabase
        .from("subscription_payments")
        .select(`
          id, 
          amount, 
          month, 
          year, 
          payment_status,
          subscription_id,
          is_skipped
        `);

      if (subPaymentsError) throw subPaymentsError;

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

      // Group by month - next 6 months
      const months: MonthlyData[] = [];
      const now = new Date();
      const futureLimit = addMonths(startOfMonth(now), 6);

      for (let i = 0; i < 6; i++) {
        const monthDate = addMonths(startOfMonth(now), i);
        months.push({
          month: monthDate,
          label: format(monthDate, "MMMM 'de' yyyy", { locale: ptBR }),
          total: 0,
          entries: [],
        });
      }

      // Add financial entries - use remaining_amount for partial payments
      entries?.forEach((entry) => {
        if (!entry.due_date) return;
        const entryDate = new Date(entry.due_date);
        const monthData = months.find(m => isSameMonth(m.month, entryDate));
        
        if (monthData) {
          // Use remaining_amount if available (for partial payments), otherwise use amount
          const forecastAmount = Number(entry.remaining_amount ?? entry.amount);
          
          // Only add if there's still something to receive
          if (forecastAmount > 0) {
            monthData.total += forecastAmount;
            monthData.entries.push({
              id: entry.id,
              description: entry.description,
              amount: forecastAmount,
              remaining_amount: entry.remaining_amount ? Number(entry.remaining_amount) : undefined,
              due_date: entry.due_date,
              payment_status: entry.payment_status,
              customer: entry.customer,
              source: "financial",
            });
          }
        }
      });

      // Generate subscription entries for each active subscription (only pending)
      (subscriptions || []).forEach(subscription => {
        const startDate = parseISO(subscription.start_date);
        const endDate = subscription.end_date ? parseISO(subscription.end_date) : futureLimit;
        const paymentDay = subscription.payment_day || 15;
        const monthlyValue = Number(subscription.monthly_value);

        let currentMonth = startOfMonth(startDate);
        
        while (isBefore(currentMonth, endDate) && isBefore(currentMonth, futureLimit)) {
          const month = currentMonth.getMonth() + 1;
          const year = currentMonth.getFullYear();

          // Check if there's already a payment record for this month
          const existingPayment = (subscriptionPayments || []).find(
            p => p.subscription_id === subscription.id && p.month === month && p.year === year
          );

          // Only include PENDING subscriptions (not paid or skipped ones)
          const paymentStatus = existingPayment?.payment_status || "pending";
          const isSkipped = existingPayment?.is_skipped === true;
          
          // Skip if already paid or skipped
          if (paymentStatus === "paid" || isSkipped) {
            currentMonth = addMonths(currentMonth, 1);
            continue;
          }

          const monthData = months.find(m => isSameMonth(m.month, currentMonth));
          
          if (monthData) {
            const paymentDate = new Date(year, month - 1, paymentDay);
            const paymentAmount = existingPayment ? Number(existingPayment.amount) : monthlyValue;
            
            monthData.total += paymentAmount;
            monthData.entries.push({
              id: existingPayment?.id || `sub-${subscription.id}-${format(currentMonth, "yyyy-MM")}`,
              description: `📋 ${subscription.title}`,
              amount: paymentAmount,
              due_date: format(paymentDate, "yyyy-MM-dd"),
              payment_status: paymentStatus,
              customer: subscription.customer,
              source: "subscription",
            });
          }

          currentMonth = addMonths(currentMonth, 1);
        }
      });

      // Sort entries by due_date within each month
      months.forEach(month => {
        month.entries.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      });

      return months;
    },
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const toggleMonth = (monthLabel: string) => {
    setExpandedMonth(expandedMonth === monthLabel ? null : monthLabel);
  };

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Previsão de Entradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalForecast = forecastData?.reduce((sum, m) => sum + m.total, 0) || 0;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Previsão de Entradas
          </CardTitle>
          <Badge variant="secondary" className="text-sm">
            <TrendingUp className="h-3 w-3 mr-1" />
            {formatCurrency(totalForecast)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 overflow-hidden max-w-full">
        {forecastData?.map((month) => {
          const isExpanded = expandedMonth === month.label;
          const isCurrentMonth = isSameMonth(month.month, new Date());

          return (
            <div key={month.label} className="border rounded-lg overflow-hidden max-w-full w-full">
              <button
                onClick={() => toggleMonth(month.label)}
                className={cn(
                  "w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors",
                  isCurrentMonth && "bg-primary/5 border-l-4 border-l-primary"
                )}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="text-left min-w-0">
                    <div className="font-medium capitalize flex items-center gap-2 flex-wrap min-w-0">
                      <span className="truncate">{month.label}</span>
                      {isCurrentMonth && (
                        <Badge variant="outline" className="text-xs">
                          Atual
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {month.entries.length} {month.entries.length === 1 ? "entrada" : "entradas"} prevista{month.entries.length !== 1 && "s"}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  "font-bold",
                  month.total > 0 ? "text-accent" : "text-muted-foreground"
                )}>
                  {formatCurrency(month.total)}
                </span>
              </button>

              {isExpanded && month.entries.length > 0 && (
                <div className="border-t bg-muted/20 p-2 sm:p-3 overflow-hidden max-w-full w-full">
                  <div className="border rounded-lg bg-background overflow-hidden divide-y w-full max-w-full">
                    {month.entries.map((entry) => (
                      <div key={entry.id} className="p-3 overflow-hidden w-full box-border" style={{ maxWidth: '100%' }}>
                        {/* Linha 1: Status + Título + Valor - Grid para forçar largura */}
                        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 w-full overflow-hidden">
                          {/* Status indicator */}
                          <div className="flex-shrink-0">
                            {entry.payment_status === "paid" && (
                              <span className="w-2 h-2 rounded-full bg-success inline-block" />
                            )}
                            {entry.payment_status === "pending" && (
                              <span className="w-2 h-2 rounded-full bg-warning inline-block" />
                            )}
                            {entry.payment_status === "partial" && (
                              <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                            )}
                          </div>
                          
                          {/* Descrição - overflow hidden forçado */}
                          <p className="text-xs sm:text-sm font-bold truncate overflow-hidden">
                            {entry.description}
                          </p>
                          
                          {/* Valor - nunca encolhe */}
                          <span className="text-xs sm:text-sm font-semibold text-accent whitespace-nowrap">
                            {formatCurrency(entry.amount)}
                          </span>
                        </div>

                        {/* Linha 2: Cliente */}
                        {entry.customer?.name && (
                          <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground truncate overflow-hidden w-full block">
                            {entry.customer.name}
                          </p>
                        )}

                        {/* Linha 3: Vencimento + Status */}
                        <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground">
                          Venc: {format(new Date(entry.due_date), "dd/MM/yyyy")} •{" "}
                          {entry.payment_status === "paid"
                            ? "Recebido"
                            : entry.payment_status === "partial"
                              ? "Parcial"
                              : "Pendente"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isExpanded && month.entries.length === 0 && (
                <div className="border-t bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                  Nenhuma entrada prevista para este mês
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
