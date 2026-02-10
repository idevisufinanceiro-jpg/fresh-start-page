import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, addMonths, isBefore, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";

export interface ReceivableEntry {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: string;
  source: "financial" | "subscription";
  customerName?: string;
}

export interface MonthlyReceivable {
  month: string;
  monthLabel: string;
  total: number;
  entries: ReceivableEntry[];
}

export function useMonthlyReceivables() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["monthly-receivables"],
    queryFn: async (): Promise<MonthlyReceivable[]> => {
      const today = new Date();
      const futureLimit = addMonths(today, 12);

      // Fetch financial entries (income only)
      const { data: entries, error: entriesError } = await supabase
        .from("financial_entries")
        .select("id, description, amount, due_date, payment_status, type")
        .eq("type", "income")
        .neq("payment_status", "paid")
        .order("due_date");

      if (entriesError) throw entriesError;

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
          is_skipped,
          subscription:subscriptions(title, customer:customers(name))
        `);

      if (subPaymentsError) throw subPaymentsError;

      // Get IDs of financial entries that come from subscription payments
      const subscriptionFinancialEntryIds = new Set(
        (subscriptionPayments || [])
          .filter(p => p.financial_entry_id)
          .map(p => p.financial_entry_id)
      );

      // Fetch active subscriptions
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

      // Build receivables data grouped by month
      const receivablesData: Record<string, { total: number; entries: ReceivableEntry[] }> = {};

      // Add financial entries (excluding those from subscription payments)
      (entries || []).forEach(entry => {
        if (!entry.due_date) return;
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
          status: entry.payment_status || "pending",
          source: "financial",
        });
      });

      // Generate subscription entries for each active subscription
      (subscriptions || []).forEach((subscription: any) => {
        const startDate = parseISO(subscription.start_date);
        const endDate = subscription.end_date ? parseISO(subscription.end_date) : futureLimit;
        const monthlyValue = Number(subscription.monthly_value);

        let currentMonth = startOfMonth(startDate);

        while (isBefore(currentMonth, endDate) && isBefore(currentMonth, futureLimit)) {
          const month = currentMonth.getMonth() + 1;
          const year = currentMonth.getFullYear();
          const monthKey = format(currentMonth, "yyyy-MM");

          // Check if there's already a payment record for this month
          const existingPayment = (subscriptionPayments || []).find(
            (p: any) => p.subscription_id === subscription.id && p.month === month && p.year === year
          );

          // Skip if already paid or skipped
          if (existingPayment?.payment_status === "paid" || existingPayment?.payment_status === "skipped" || existingPayment?.is_skipped === true) {
            currentMonth = addMonths(currentMonth, 1);
            continue;
          }

          if (!receivablesData[monthKey]) {
            receivablesData[monthKey] = { total: 0, entries: [] };
          }

          // Use payment_day if available, otherwise use last day of month
          const paymentDay = subscription.payment_day || 28;
          const lastDayOfMonth = new Date(year, month, 0).getDate();
          const actualPaymentDay = Math.min(paymentDay, lastDayOfMonth);
          const paymentDate = new Date(year, month - 1, actualPaymentDay);
          
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

      // Sort by month
      return Object.entries(receivablesData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, data]) => ({
          month,
          monthLabel: format(parseISO(month + "-01"), "MMMM 'de' yyyy", { locale: ptBR }),
          ...data,
        }));
    },
    enabled: !!user,
    staleTime: 10000, // 10 segundos - atualiza rápido
    gcTime: 60000, // 1 minuto em cache
    refetchOnWindowFocus: true,
  });
}
