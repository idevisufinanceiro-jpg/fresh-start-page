import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  TrendingDown, 
  ChevronDown, 
  ChevronRight,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowRightLeft,
  Clock,
  CheckCircle
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useHideValues } from "@/hooks/useHideValues";
import { useFinancialRealtime } from "@/hooks/useFinancialRealtime";

interface ExpenseEntry {
  id: string;
  description: string;
  amount: number;
  due_date: string | null;
  payment_status: string;
  payment_method: string | null;
  category_name?: string;
  category_color?: string;
}

interface MonthlyExpense {
  month: string;
  monthLabel: string;
  total: number;
  paidTotal: number;
  pendingTotal: number;
  entries: ExpenseEntry[];
}

const paymentMethodIcons: Record<string, React.ReactNode> = {
  pix: <Smartphone className="h-3.5 w-3.5" />,
  cash: <Banknote className="h-3.5 w-3.5" />,
  card: <CreditCard className="h-3.5 w-3.5" />,
  transfer: <ArrowRightLeft className="h-3.5 w-3.5" />,
  open: <Clock className="h-3.5 w-3.5" />,
};

export function ExpensesByMonth() {
  useFinancialRealtime();
  const { hideValues, formatValue } = useHideValues();
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  const { data: monthlyExpenses, isLoading } = useQuery({
    queryKey: ["expenses-by-month"],
    queryFn: async (): Promise<MonthlyExpense[]> => {
      const { data: entries, error } = await supabase
        .from("financial_entries")
        .select("id, description, amount, due_date, payment_status, payment_method, created_at, expense_categories(name, color)")
        .eq("type", "expense")
        .order("due_date", { ascending: false });

      if (error) throw error;

      // Group by month
      const groupedByMonth: Record<string, { total: number; paidTotal: number; pendingTotal: number; entries: ExpenseEntry[] }> = {};

      (entries || []).forEach(entry => {
        const dateToUse = entry.due_date || entry.created_at;
        const monthKey = format(parseISO(dateToUse), "yyyy-MM");

        if (!groupedByMonth[monthKey]) {
          groupedByMonth[monthKey] = { total: 0, paidTotal: 0, pendingTotal: 0, entries: [] };
        }

        const amount = Number(entry.amount);
        groupedByMonth[monthKey].total += amount;
        
        if (entry.payment_status === "paid") {
          groupedByMonth[monthKey].paidTotal += amount;
        } else {
          groupedByMonth[monthKey].pendingTotal += amount;
        }

        groupedByMonth[monthKey].entries.push({
          id: entry.id,
          description: entry.description,
          amount,
          due_date: entry.due_date,
          payment_status: entry.payment_status || "pending",
          payment_method: entry.payment_method,
          category_name: (entry.expense_categories as any)?.name,
          category_color: (entry.expense_categories as any)?.color,
        });
      });

      return Object.entries(groupedByMonth)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([month, data]) => ({
          month,
          monthLabel: format(parseISO(month + "-01"), "MMMM 'de' yyyy", { locale: ptBR }),
          ...data,
        }));
    },
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });

  const toggleMonth = (month: string) => {
    setOpenMonths(prev => ({ ...prev, [month]: !prev[month] }));
  };

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalGeral = monthlyExpenses?.reduce((sum, m) => sum + m.total, 0) || 0;

  return (
    <Card className="shadow-card">
      <CardHeader className="p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-destructive" />
              Despesas por Mês
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Total: {formatValue(totalGeral, formatCurrency)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 space-y-3">
        {monthlyExpenses?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-accent" />
            <p>Nenhuma despesa registrada</p>
          </div>
        ) : (
          monthlyExpenses?.map((month) => (
            <Collapsible
              key={month.month}
              open={openMonths[month.month]}
              onOpenChange={() => toggleMonth(month.month)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-4 h-auto hover:bg-muted/50 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {openMonths[month.month] ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium capitalize">{month.monthLabel}</span>
                    <Badge variant="secondary" className="text-xs">
                      {month.entries.length} {month.entries.length === 1 ? "despesa" : "despesas"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    {month.pendingTotal > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Pendente: {formatValue(month.pendingTotal, formatCurrency)}
                      </span>
                    )}
                    <span className="font-bold text-destructive">
                      {formatValue(month.total, formatCurrency)}
                    </span>
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-2 pl-8 pr-4">
                  {month.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {entry.category_color && (
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: entry.category_color }}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{entry.description}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {entry.due_date && (
                              <span>{format(parseISO(entry.due_date), "dd/MM/yyyy")}</span>
                            )}
                            {entry.category_name && (
                              <Badge variant="outline" className="text-[10px] h-4">
                                {entry.category_name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs gap-1",
                            entry.payment_status === "paid"
                              ? "bg-accent/10 text-accent"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          )}
                        >
                          {entry.payment_method && paymentMethodIcons[entry.payment_method]}
                          {entry.payment_status === "paid" ? "Pago" : "Pendente"}
                        </Badge>
                        <span className="font-medium text-destructive whitespace-nowrap">
                          {formatValue(entry.amount, formatCurrency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))
        )}
      </CardContent>
    </Card>
  );
}
