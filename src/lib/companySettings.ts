import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export type CompanySettings = Tables<"company_settings">;

/**
 * Retorna o registro “principal” das configurações da empresa.
 * Hoje usamos o mais antigo (created_at ASC), pois é o primeiro criado (admin) e é o que todos devem enxergar.
 */
export async function fetchSharedCompanySettings(
  select: string = "*"
): Promise<CompanySettings | null> {
  const { data, error } = await supabase
    .from("company_settings")
    // Dynamic select string makes generated types unhappy; keep it permissive.
    .select(select as any)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as CompanySettings | null);
}
