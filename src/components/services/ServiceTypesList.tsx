import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "@/hooks/use-toast";
import { Plus, MoreVertical, Edit, Trash2, Search, Package, Loader2, Power, PowerOff } from "lucide-react";

interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  category: string;
  is_active: boolean;
  created_at: string;
}

export function ServiceTypesList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ServiceType | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultPrice, setDefaultPrice] = useState(0);
  const [category, setCategory] = useState("other");
  const [isActive, setIsActive] = useState(true);

  const { data: serviceTypes, isLoading } = useQuery({
    queryKey: ["service-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_types")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as ServiceType[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (selectedType) {
      setName(selectedType.name);
      setDescription(selectedType.description || "");
      setDefaultPrice(selectedType.default_price || 0);
      setCategory(selectedType.category);
      setIsActive(selectedType.is_active);
    } else {
      setName("");
      setDescription("");
      setDefaultPrice(0);
      setCategory("other");
      setIsActive(true);
    }
  }, [selectedType, dialogOpen]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");

      const data = {
        user_id: user.id,
        name,
        description: description || null,
        default_price: defaultPrice,
        category,
        is_active: isActive,
      };

      if (selectedType) {
        const { error } = await supabase
          .from("service_types")
          .update(data)
          .eq("id", selectedType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("service_types")
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-types"] });
      toast({ title: selectedType ? "Tipo de serviço atualizado!" : "Tipo de serviço criado!" });
      setDialogOpen(false);
      setSelectedType(null);
    },
    onError: () => {
      toast({ title: "Erro ao salvar tipo de serviço", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("service_types")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-types"] });
      toast({ title: "Status atualizado!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-types"] });
      toast({ title: "Tipo de serviço excluído!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir tipo de serviço", variant: "destructive" });
    },
  });

  const handleNew = () => {
    setSelectedType(null);
    setDialogOpen(true);
  };

  const handleEdit = (type: ServiceType) => {
    setSelectedType(type);
    setDialogOpen(true);
  };

  const filteredTypes = serviceTypes?.filter(type => {
    const matchesSearch = type.name.toLowerCase().includes(search.toLowerCase()) ||
      type.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = showInactive || type.is_active;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const activeCount = serviceTypes?.filter(t => t.is_active).length || 0;
  const inactiveCount = serviceTypes?.filter(t => !t.is_active).length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Tipos de Serviços
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {activeCount} ativos · {inactiveCount} inativos
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="showInactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="showInactive" className="text-sm">Mostrar inativos</Label>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar serviços..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Tipo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTypes?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum tipo de serviço encontrado</p>
              <p className="text-sm">Cadastre os tipos de serviços que você oferece</p>
            </div>
          ) : (
            <>
              {/* Mobile view */}
              <div className="md:hidden space-y-3">
                {filteredTypes?.map((type) => (
                  <div key={type.id} className={`border rounded-lg p-4 space-y-3 ${!type.is_active ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{type.name}</p>
                        {type.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{type.description}</p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(type)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleActiveMutation.mutate({ id: type.id, is_active: !type.is_active })}>
                            {type.is_active ? (
                              <>
                                <PowerOff className="h-4 w-4 mr-2" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <Power className="h-4 w-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(type.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant={type.is_active ? "default" : "secondary"}>
                        {type.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      <span className="font-medium text-primary">{formatCurrency(type.default_price)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor Padrão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTypes?.map((type) => (
                      <TableRow key={type.id} className={!type.is_active ? 'opacity-60' : ''}>
                        <TableCell className="font-medium">{type.name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[300px] truncate">
                          {type.description || "-"}
                        </TableCell>
                        <TableCell className="font-medium text-primary">
                          {formatCurrency(type.default_price)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={type.is_active}
                              onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: type.id, is_active: checked })}
                            />
                            <Badge variant={type.is_active ? "default" : "secondary"}>
                              {type.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(type)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(type.id)}
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
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedType ? "Editar Tipo de Serviço" : "Novo Tipo de Serviço"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Design de Logo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição do serviço..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultPrice">Valor Padrão</Label>
              <CurrencyInput
                id="defaultPrice"
                value={defaultPrice}
                onChange={setDefaultPrice}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="isActive">Serviço ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
