import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useStorageRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("storage-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customers" },
        () => queryClient.invalidateQueries({ queryKey: ["storage-stats"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes" },
        () => queryClient.invalidateQueries({ queryKey: ["storage-stats"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quote_items" },
        () => queryClient.invalidateQueries({ queryKey: ["storage-stats"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => queryClient.invalidateQueries({ queryKey: ["storage-stats"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sale_items" },
        () => queryClient.invalidateQueries({ queryKey: ["storage-stats"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "services" },
        () => queryClient.invalidateQueries({ queryKey: ["storage-stats"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_entries" },
        () => queryClient.invalidateQueries({ queryKey: ["storage-stats"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attachments" },
        () => queryClient.invalidateQueries({ queryKey: ["storage-stats"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions" },
        () => queryClient.invalidateQueries({ queryKey: ["storage-stats"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscription_payments" },
        () => queryClient.invalidateQueries({ queryKey: ["storage-stats"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => queryClient.invalidateQueries({ queryKey: ["storage-stats"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        () => queryClient.invalidateQueries({ queryKey: ["storage-stats"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
