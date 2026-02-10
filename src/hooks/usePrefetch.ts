import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook para prefetch de dados frequentemente acessados
 * Carrega dados em background após o login para navegação mais rápida
 */
export function usePrefetch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Delay para não competir com o carregamento inicial
    const timer = setTimeout(() => {
      // Prefetch clientes (usado em várias páginas)
      queryClient.prefetchQuery({
        queryKey: ["customers"],
        staleTime: 2 * 60 * 1000,
        queryFn: async () => {
          const { data } = await supabase
            .from("customers")
            .select("*")
            .order("name");
          return data || [];
        },
      });

      // Prefetch orçamentos
      queryClient.prefetchQuery({
        queryKey: ["quotes"],
        staleTime: 2 * 60 * 1000,
        queryFn: async () => {
          const { data } = await supabase
            .from("quotes")
            .select("*, customers(*)")
            .order("created_at", { ascending: false });
          return data || [];
        },
      });

      // Prefetch vendas
      queryClient.prefetchQuery({
        queryKey: ["sales"],
        staleTime: 2 * 60 * 1000,
        queryFn: async () => {
          const { data } = await supabase
            .from("sales")
            .select("*, customers(name)")
            .order("sold_at", { ascending: false });
          return data || [];
        },
      });

      // Prefetch entradas financeiras
      queryClient.prefetchQuery({
        queryKey: ["financial-entries"],
        staleTime: 2 * 60 * 1000,
        queryFn: async () => {
          const { data } = await supabase
            .from("financial_entries")
            .select("*")
            .order("created_at", { ascending: false });
          return data || [];
        },
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [user, queryClient]);
}
