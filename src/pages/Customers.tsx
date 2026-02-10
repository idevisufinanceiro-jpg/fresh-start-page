import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Mail, Phone, Building, MoreHorizontal, Edit, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { CustomerFormDialog } from "@/components/customers/CustomerFormDialog";
import { TableSkeleton } from "@/components/ui/page-skeleton";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

export default function Customers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente excluído!");
    },
    onError: () => {
      toast.error("Erro ao excluir cliente");
    },
  });

  const filteredCustomers = customers?.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm)
  );

  const handleNewCustomer = () => {
    setSelectedCustomer(null);
    setIsDialogOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleDeleteCustomer = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cliente?")) {
      deleteMutation.mutate(id);
    }
  };

  const getClientTypeBadge = (type: string | null) => {
    return type === "company" 
      ? <Badge variant="outline" className="text-xs">PJ</Badge>
      : <Badge variant="secondary" className="text-xs">PF</Badge>;
  };

  return (
    <div className="space-y-4 md:space-y-6 overflow-x-hidden w-full max-w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-hidden">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground truncate">Clientes</h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base truncate">Gerencie sua base de clientes</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto flex-shrink-0" onClick={handleNewCustomer}>
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      <Card className="shadow-card">
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {isLoading ? (
            <div className="py-4">
              <TableSkeleton rows={5} columns={5} />
            </div>
          ) : filteredCustomers?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum cliente encontrado</p>
            </div>
          ) : (
            <>
              {/* Mobile Cards View */}
              <div className="block md:hidden space-y-3 overflow-x-hidden">
                {filteredCustomers?.map((customer) => (
                  <div key={customer.id} className="border rounded-lg p-4 space-y-2 overflow-hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <p className="font-medium truncate flex-1">{customer.name}</p>
                        <span className="flex-shrink-0">{getClientTypeBadge(customer.client_type)}</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditCustomer(customer)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteCustomer(customer.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-hidden">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-hidden">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{customer.phone}</span>
                      </div>
                    )}
                    {customer.company && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-hidden">
                        <Building className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{customer.company}</span>
                      </div>
                    )}
                    {customer.cpf_cnpj && (
                      <div className="text-xs text-muted-foreground truncate">
                        {customer.client_type === "company" ? "CNPJ" : "CPF"}: {customer.cpf_cnpj}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers?.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{getClientTypeBadge(customer.client_type)}</TableCell>
                        <TableCell className="text-sm">{customer.cpf_cnpj || "-"}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {customer.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {customer.phone}
                              </div>
                            )}
                            {customer.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                {customer.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.company && (
                            <div className="flex items-center gap-2">
                              <Building className="h-3 w-3 text-muted-foreground" />
                              {customer.company}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditCustomer(customer)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteCustomer(customer.id)}
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

      <CustomerFormDialog
        customer={selectedCustomer}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
}
