import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { Plus, Search, MoreHorizontal, Eye, Pencil, Trash2, Play, CheckCircle, Loader2, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Service = Tables<"services"> & {
  customers?: Tables<"customers"> | null;
};

interface ServicesListProps {
  onNew: () => void;
  onEdit: (service: Service) => void;
  onView: (service: Service) => void;
}

const categoryLabels: Record<string, string> = {
  wedding: "Casamento",
  corporate: "Corporativo",
  birthday: "Aniversário",
  graduation: "Formatura",
  baptism: "Batizado",
  other: "Outro",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Agendado", variant: "outline" },
  in_progress: { label: "Em Andamento", variant: "default" },
  completed: { label: "Concluído", variant: "secondary" },
};

export function ServicesList({ onNew, onEdit, onView }: ServicesListProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: services, isLoading } = useQuery({
    queryKey: ["services"],
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*, customers(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Service[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { status };
      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.completed_at = null;
      }
      const { error } = await supabase
        .from("services")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({ title: "Status atualizado" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({ title: "Serviço removido" });
    },
  });

  const filteredServices = services?.filter(
    (service) =>
      service.title.toLowerCase().includes(search.toLowerCase()) ||
      service.customers?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Serviços e Projetos
          </CardTitle>
          <div className="flex gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar serviços..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={onNew}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Serviço
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredServices?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum serviço encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices?.map((service) => (
                  <TableRow key={service.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onView(service)}>
                    <TableCell className="font-medium">{service.title}</TableCell>
                    <TableCell>{service.customers?.name || "—"}</TableCell>
                    <TableCell>{categoryLabels[service.category || "other"]}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[service.status || "scheduled"].variant}>
                        {statusConfig[service.status || "scheduled"].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {service.due_date
                        ? format(new Date(service.due_date), "dd/MM/yyyy", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {service.total_value
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(service.total_value)
                        : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView(service)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(service)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => updateStatusMutation.mutate({ id: service.id, status: "in_progress" })}
                            disabled={service.status === "in_progress"}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Iniciar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateStatusMutation.mutate({ id: service.id, status: "completed" })}
                            disabled={service.status === "completed"}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Concluir
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(service.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
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
