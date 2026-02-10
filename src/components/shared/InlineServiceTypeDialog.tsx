import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "sonner";

interface InlineServiceTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServiceCreated: (serviceId: string, serviceName: string, defaultPrice: number) => void;
}

export function InlineServiceTypeDialog({ open, onOpenChange, onServiceCreated }: InlineServiceTypeDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultPrice, setDefaultPrice] = useState(0);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setDefaultPrice(0);
    }
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      if (!name.trim()) throw new Error("Nome é obrigatório");

      const { data: newService, error } = await supabase
        .from("service_types")
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          default_price: defaultPrice,
          is_active: true,
          category: "other",
        })
        .select()
        .single();
      
      if (error) throw error;
      return newService;
    },
    onSuccess: (newService) => {
      queryClient.invalidateQueries({ queryKey: ["service-types-active"] });
      toast.success("Serviço cadastrado!");
      onServiceCreated(newService.id, newService.name, newService.default_price || 0);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao salvar serviço");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Serviço</DialogTitle>
          <DialogDescription>
            Após cadastrar, o serviço estará disponível para seleção
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service-name">Nome do Serviço *</Label>
            <Input
              id="service-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Design de Logo"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-description">Descrição</Label>
            <Textarea
              id="service-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes do serviço..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-price">Preço Padrão</Label>
            <CurrencyInput
              id="service-price"
              value={defaultPrice}
              onChange={setDefaultPrice}
            />
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
              {saveMutation.isPending ? "Salvando..." : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
