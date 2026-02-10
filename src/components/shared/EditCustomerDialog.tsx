import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { formatCPFCNPJ, formatCEP, formatPhone } from "@/lib/formatters";
import { customerFormSchema, validateCnpjResponse, sanitizeString, type CustomerFormData } from "@/lib/validations/customerSchema";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

interface EditCustomerDialogProps {
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const initialFormData: CustomerFormData = {
  name: "",
  email: "",
  phone: "",
  company: "",
  address: "",
  city: "",
  state: "",
  cep: "",
  cpf_cnpj: "",
  client_type: "individual",
  notes: "",
};

export function EditCustomerDialog({ customerId, open, onOpenChange, onSuccess }: EditCustomerDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch customer data
  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId && open,
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        company: customer.company || "",
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        cep: customer.cep || "",
        cpf_cnpj: customer.cpf_cnpj || "",
        client_type: customer.client_type || "individual",
        notes: customer.notes || "",
      });
      setValidationErrors({});
    }
  }, [customer]);

  // Buscar dados via Edge Function (evita CORS)
  const searchCnpj = async () => {
    const cnpj = formData.cpf_cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) {
      toast.error("CNPJ deve ter 14 dígitos");
      return;
    }

    setIsSearchingCnpj(true);

    try {
      const { data, error } = await supabase.functions.invoke("cnpj-lookup", {
        body: { cnpj },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      const validatedData = validateCnpjResponse(data);
      
      if (!validatedData) {
        throw new Error("Resposta da API inválida");
      }
      
      setFormData(prev => ({
        ...prev,
        name: sanitizeString(validatedData.razao_social || validatedData.nome_fantasia) || prev.name,
        company: sanitizeString(validatedData.nome_fantasia || validatedData.razao_social) || prev.company,
        address: sanitizeString(
          `${validatedData.logradouro || ""}, ${validatedData.numero || ""} - ${validatedData.bairro || ""}`.trim().replace(/^,\s*-\s*$/, "")
        ) || prev.address,
        city: sanitizeString(validatedData.municipio) || prev.city,
        state: sanitizeString(validatedData.uf) || prev.state,
        cep: validatedData.cep?.replace(/\D/g, "") || prev.cep,
        email: sanitizeString(validatedData.email) || prev.email,
        phone: sanitizeString(validatedData.ddd_telefone_1) || prev.phone,
        client_type: "company",
      }));
      
      toast.success("Dados do CNPJ carregados!");
    } catch (error) {
      console.error("CNPJ lookup error:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível buscar o CNPJ");
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!user) throw new Error("Usuário não autenticado");

      const customerData = {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        cep: data.cep || null,
        cpf_cnpj: data.cpf_cnpj || null,
        client_type: data.client_type,
        notes: data.notes || null,
      };

      const { error } = await supabase
        .from("customers")
        .update(customerData)
        .eq("id", customerId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      toast.success("Cliente atualizado!");
      onSuccess?.();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao atualizar cliente");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    const result = customerFormSchema.safeParse(formData);
    
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setValidationErrors(errors);
      const firstError = result.error.errors[0]?.message;
      toast.error(firstError || "Verifique os campos do formulário");
      return;
    }
    
    saveMutation.mutate(result.data);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg" aria-describedby={undefined}>
          <VisuallyHidden.Root>
            <DialogTitle>Carregando cliente</DialogTitle>
          </VisuallyHidden.Root>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Atualize as informações do cliente selecionado
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="edit-name">Nome *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>

            <div>
              <Label htmlFor="edit-client_type">Tipo</Label>
              <Select
                value={formData.client_type}
                onValueChange={(value: "individual" | "company") =>
                  setFormData({ ...formData, client_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Pessoa Física</SelectItem>
                  <SelectItem value="company">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-cpf_cnpj">
                {formData.client_type === "company" ? "CNPJ" : "CPF"}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="edit-cpf_cnpj"
                  value={formData.cpf_cnpj}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    cpf_cnpj: formatCPFCNPJ(e.target.value, formData.client_type) 
                  })}
                  placeholder={formData.client_type === "company" ? "00.000.000/0000-00" : "000.000.000-00"}
                  className="flex-1"
                />
                {formData.client_type === "company" && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={searchCnpj}
                    disabled={isSearchingCnpj}
                    title="Buscar CNPJ"
                  >
                    {isSearchingCnpj ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="edit-phone">Telefone *</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="edit-company">Empresa</Label>
              <Input
                id="edit-company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="edit-address">Endereço</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, bairro"
              />
            </div>

            <div>
              <Label htmlFor="edit-city">Cidade</Label>
              <Input
                id="edit-city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Cidade"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="edit-state">Estado</Label>
                <Input
                  id="edit-state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
              <div>
                <Label htmlFor="edit-cep">CEP</Label>
                <Input
                  id="edit-cep"
                  value={formData.cep}
                  onChange={(e) => setFormData({ ...formData, cep: formatCEP(e.target.value) })}
                  placeholder="00000-000"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="edit-notes">Observações</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas sobre o cliente..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
