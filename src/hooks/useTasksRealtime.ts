import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTasksRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_statuses" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["task-statuses"] });
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_tags" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["task-tags"] });
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_tag_assignments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_checklists" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
