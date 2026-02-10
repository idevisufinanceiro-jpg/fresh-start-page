import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  getYear, 
  startOfYear, 
  parseISO, 
  addMonths, 
  isBefore, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval,
  format 
} from "date-fns";

export interface FinancialMetrics {
  // Income metrics
  totalPaidIncome: number;
  paidIncomeFromFinancial: number;
  paidSubscriptionIncome: number;
  totalPendingIncome: number;
  pendingIncomeFromFinancial: number;
  pendingSubscriptionIncome: number;
  
  // Expense metrics
  totalPaidExpenses: number;
  totalPendingExpenses: number;
  
  // Calculated metrics
  balance: number;
  profit: number;
  profitMargin: number;
  breakEvenProgress: number;
  surplusDeficit: number;
  
  // Annual metrics
  annualPaidIncome: number;
  
  // Raw data for further processing
  financialEntries: any[];
  subscriptionPayments: any[];
  subscriptions: any[];
  subscriptionFinancialEntryIds: Set<string>;
}

interface UseFinancialDataOptions {
  startDate?: string;
  endDate?: string;
  customerId?: string;
}

export function useFinancialData(options: UseFinancialDataOptions = {}) {
  const { user } = useAuth();
  const { startDate, endDate, customerId } = options;

  return useQuery({
    queryKey: ["financial-unified-data", startDate, endDate, customerId],
    queryFn: async (): Promise<FinancialMetrics> => {
      const currentYear = getYear(new Date());
      const today = new Date();
      const futureLimit = addMonths(today, 12);
      const thisMonth = today.getMonth() + 1;
      const thisYear = today.getFullYear();

      // Build query for financial entries
      let entriesQuery = supabase
        .from("financial_entries")
        .select("*, expense_categories(name, color), customers(name)")
        .order("created_at");
      
      if (startDate) {
        entriesQuery = entriesQuery.gte("created_at", startDate);
      }
      if (endDate) {
        entriesQuery = entriesQuery.lte("created_at", endDate + "T23:59:59");
      }

      const { data: entries, error } = await entriesQuery;
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
          paid_at,
          is_skipped,
          subscription:subscriptions(title, payment_day, customer:customers(name))
        `);

      if (subPaymentsError) throw subPaymentsError;

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

      // Get IDs of financial entries that come from subscription payments (to avoid duplication)
      const subscriptionFinancialEntryIds = new Set(
        (subscriptionPayments || [])
          .filter((p: any) => p.financial_entry_id)
          .map((p: any) => p.financial_entry_id)
      );

      // Filter entries - exclude income that came from subscriptions to avoid duplication
      let filteredEntries = (entries || []).filter((e: any) => 
        customerId === "all" || !customerId || e.customer_id === customerId
      );

      // Separate income and expenses - exclude subscription-linked income entries
      const incomeEntries = filteredEntries.filter(
        (e: any) => e.type === "income" && !subscriptionFinancialEntryIds.has(e.id)
      );
      const expenseEntries = filteredEntries.filter((e: any) => e.type === "expense");

      // Calculate paid income from financial entries
      const paidIncomeFromFinancial = incomeEntries
        .filter((e: any) => e.payment_status === "paid")
        .reduce((sum: number, e: any) => sum + Number(e.amount), 0);

      // Calculate pending income from financial entries
      const pendingIncomeFromFinancial = incomeEntries
        .filter((e: any) => e.payment_status === "pending" || e.payment_status === "partial")
        .reduce((sum: number, e: any) => sum + Number(e.remaining_amount || e.amount), 0);

      // Calculate paid subscription income
      // Since we excluded financial entries that came from subscriptions,
      // we need to add ALL paid subscription payments here
      let filteredSubPayments = subscriptionPayments || [];
      if (startDate && endDate) {
        const rangeStart = parseISO(startDate);
        const rangeEnd = parseISO(endDate + "T23:59:59");
        filteredSubPayments = (subscriptionPayments || []).filter((p: any) => {
          if (p.payment_status !== "paid" || !p.paid_at) return false;
          const paidDate = parseISO(p.paid_at);
          return isWithinInterval(paidDate, { start: rangeStart, end: rangeEnd });
        });
      }

      const paidSubscriptionIncome = filteredSubPayments
        .filter((p: any) => p.payment_status === "paid")
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      // Calculate pending subscription payments
      let pendingSubscriptionIncome = 0;
      (subscriptions || []).forEach((subscription: any) => {
        const subStartDate = parseISO(subscription.start_date);
        const subEndDate = subscription.end_date ? parseISO(subscription.end_date) : futureLimit;
        let currentMonth = startOfMonth(subStartDate);
        
        while (isBefore(currentMonth, subEndDate) && isBefore(currentMonth, futureLimit)) {
          const month = currentMonth.getMonth() + 1;
          const year = currentMonth.getFullYear();

          const existingPayment = (subscriptionPayments || []).find(
            (p: any) => p.subscription_id === subscription.id && p.month === month && p.year === year
          );

          // Skip if already paid or skipped
          if (existingPayment?.payment_status === "paid" || existingPayment?.is_skipped === true) {
            currentMonth = addMonths(currentMonth, 1);
            continue;
          }

          if (!existingPayment || existingPayment.payment_status === "pending") {
            pendingSubscriptionIncome += Number(subscription.monthly_value);
          }

          currentMonth = addMonths(currentMonth, 1);
        }
      });

      // Calculate expenses
      const totalPaidExpenses = expenseEntries
        .filter((e: any) => e.payment_status === "paid")
        .reduce((sum: number, e: any) => sum + Number(e.amount), 0);

      const totalPendingExpenses = expenseEntries
        .filter((e: any) => e.payment_status === "pending")
        .reduce((sum: number, e: any) => sum + Number(e.amount), 0);

      // Total calculations
      const totalPaidIncome = paidIncomeFromFinancial + paidSubscriptionIncome;
      const totalPendingIncome = pendingIncomeFromFinancial + pendingSubscriptionIncome;
      
      // Balance and profit
      const balance = totalPaidIncome - totalPaidExpenses;
      const profit = totalPaidIncome - totalPaidExpenses;
      const profitMargin = totalPaidIncome > 0 ? ((profit / totalPaidIncome) * 100) : 0;

      // Break-even calculation
      const breakEvenProgress = totalPaidExpenses > 0 
        ? (totalPaidIncome / totalPaidExpenses) * 100 
        : (totalPaidIncome > 0 ? 200 : 0);
      
      const surplusDeficit = totalPaidIncome - totalPaidExpenses;

      // Annual income (current year only)
      const annualPaidIncomeFromFinancial = incomeEntries
        .filter((e: any) => new Date(e.created_at).getFullYear() === currentYear && e.payment_status === "paid")
        .reduce((sum: number, e: any) => sum + Number(e.amount), 0);
      
      const annualPaidSubscriptionIncome = (subscriptionPayments || [])
        .filter((p: any) => p.payment_status === "paid" && p.year === currentYear)
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      const annualPaidIncome = annualPaidIncomeFromFinancial + annualPaidSubscriptionIncome;

      return {
        totalPaidIncome,
        paidIncomeFromFinancial,
        paidSubscriptionIncome,
        totalPendingIncome,
        pendingIncomeFromFinancial,
        pendingSubscriptionIncome,
        totalPaidExpenses,
        totalPendingExpenses,
        balance,
        profit,
        profitMargin,
        breakEvenProgress,
        surplusDeficit,
        annualPaidIncome,
        financialEntries: filteredEntries,
        subscriptionPayments: subscriptionPayments || [],
        subscriptions: subscriptions || [],
        subscriptionFinancialEntryIds,
      };
    },
    enabled: !!user,
    staleTime: 30000,
    gcTime: 300000,
  });
}
