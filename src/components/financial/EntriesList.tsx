import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialRealtime } from "@/hooks/useFinancialRealtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Search, 
  TrendingUp, 
  TrendingDown,
  MoreVertical, 
  Edit, 
  Trash2,
  CheckCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type FinancialEntry = Tables<"financial_entries"> & {
  customers?: { name: string } | null;
  expense_categories?: { name: string; color: string } | null;
};

interface EntriesListProps {
  type: "income" | "expense";
  onNewEntry: () => void;
  onEditEntry: (entry: FinancialEntry) => void;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  card: "Cartão",
  transfer: "Transferência",
};

const paymentStatusLabels: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  partial: "Parcial",
};

const paymentStatusColors: Record<string, string> = {
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  partial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export function EntriesList({ type, onNewEntry, onEditEntry }: EntriesListProps) {
  // Realtime updates
  useFinancialRealtime();
  
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: entries, isLoading } = useQuery({
    queryKey: ["financial-entries", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, customers(name), expense_categories(name, color)")
        .eq("type", type)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as FinancialEntry[];
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_entries")
        .update({ 
          payment_status: "paid",
          paid_at: new Date().toISOString()
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      toast({ title: "Marcado como pago!" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_entries")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      toast({ title: "Lançamento excluído!" });
    },
  });

  const filteredEntries = entries?.filter(entry => 
    entry.description.toLowerCase().includes(search.toLowerCase()) ||
    entry.customers?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const total = entries?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  const paidTotal = entries?.filter(e => e.payment_status === "paid")
    .reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            {type === "income" ? (
              <TrendingUp className="h-5 w-5 text-accent" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )}
            {type === "income" ? "Receitas" : "Despesas"}
          </CardTitle>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
            <span>Total: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span>Pago: R$ {paidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <Button onClick={onNewEntry} className={cn(
          type === "income" ? "bg-accent hover:bg-accent/90" : "bg-destructive hover:bg-destructive/90"
        )}>
          <Plus className="h-4 w-4 mr-2" />
          {type === "income" ? "Nova Receita" : "Nova Despesa"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredEntries?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum lançamento encontrado</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>{type === "income" ? "Cliente" : "Categoria"}</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.description}</TableCell>
                    <TableCell>
                      {type === "income" ? (
                        entry.customers?.name || "-"
                      ) : (
                        entry.expense_categories ? (
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: entry.expense_categories.color }}
                            />
                            {entry.expense_categories.name}
                          </div>
                        ) : "-"
                      )}
                    </TableCell>
                    <TableCell className={cn(
                      "font-medium",
                      type === "income" ? "text-accent" : "text-destructive"
                    )}>
                      R$ {Number(entry.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{paymentMethodLabels[entry.payment_method || "pix"]}</TableCell>
                    <TableCell>
                      <Badge className={paymentStatusColors[entry.payment_status || "pending"]}>
                        {paymentStatusLabels[entry.payment_status || "pending"]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.due_date 
                        ? format(new Date(entry.due_date), "dd/MM/yyyy", { locale: ptBR })
                        : "-"
                      }
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEditEntry(entry)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {entry.payment_status !== "paid" && (
                            <DropdownMenuItem onClick={() => markAsPaidMutation.mutate(entry.id)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Marcar como Pago
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => deleteMutation.mutate(entry.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
