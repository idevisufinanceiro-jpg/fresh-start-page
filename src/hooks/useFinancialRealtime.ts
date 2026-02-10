import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook centralizado para atualização em tempo real de dados financeiros.
 * Quando qualquer dado financeiro muda (financial_entries, subscription_payments, subscriptions, sales),
 * invalida todas as queries relacionadas para garantir consistência em todo o sistema.
 */
export function useFinancialRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateAllFinancialQueries = () => {
      // Invalidate all financial-related queries with refetchType: 'all' to force immediate refetch
      const options = { refetchType: 'all' as const };
      queryClient.invalidateQueries({ queryKey: ["financial-dashboard-data"], ...options });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"], ...options });
      queryClient.invalidateQueries({ queryKey: ["financial-charts-updated"], ...options });
      queryClient.invalidateQueries({ queryKey: ["monthly-forecast"], ...options });
      queryClient.invalidateQueries({ queryKey: ["monthly-receivables"], ...options });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"], ...options });
      queryClient.invalidateQueries({ queryKey: ["reports-data"], ...options });
      queryClient.invalidateQueries({ queryKey: ["open-accounts"], ...options });
      queryClient.invalidateQueries({ queryKey: ["received-payments"], ...options });
      queryClient.invalidateQueries({ queryKey: ["expense-entries"], ...options });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"], ...options });
      queryClient.invalidateQueries({ queryKey: ["financial-unified-data"], ...options });
      queryClient.invalidateQueries({ queryKey: ["sales"], ...options });
    };

    const channel = supabase
      .channel("financial-realtime-global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_entries" },
        () => {
          invalidateAllFinancialQueries();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscription_payments" },
        () => {
          invalidateAllFinancialQueries();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions" },
        () => {
          invalidateAllFinancialQueries();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => {
          invalidateAllFinancialQueries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
