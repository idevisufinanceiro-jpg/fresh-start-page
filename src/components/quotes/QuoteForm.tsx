import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, UserPlus, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ServiceItemSelector, ItemForm } from "@/components/shared/ServiceItemSelector";
import { CustomerSearchSelect } from "@/components/shared/CustomerSearchSelect";
import { InlineCustomerDialog } from "@/components/shared/InlineCustomerDialog";
import { EditCustomerDialog } from "@/components/shared/EditCustomerDialog";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Quote = Tables<"quotes">;

interface QuoteFormProps {
  quote?: Quote | null;
  onBack: () => void;
  onSuccess: () => void;
}

const categoryLabels: Record<string, string> = {
  graphic_design: "Design Gráfico",
  visual_identity: "Identidade Visual",
  institutional_video: "Vídeo Institucional",
  event_coverage: "Cobertura de Eventos",
  social_media: "Social Media",
  photography: "Fotografia",
  motion_design: "Motion Design",
  other: "Outros",
};

export function QuoteForm({ quote, onBack, onSuccess }: QuoteFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [description, setDescription] = useState(quote?.description || "");
  const [customerId, setCustomerId] = useState(quote?.customer_id || "");
  const [category, setCategory] = useState<string>(quote?.category || "other");
  const [discount, setDiscount] = useState(quote?.discount || 0);
  const [notes, setNotes] = useState(quote?.notes || "");
  const [validUntil, setValidUntil] = useState(quote?.valid_until || "");
  const [deliveryDate, setDeliveryDate] = useState((quote as any)?.delivery_date || "");
  const [items, setItems] = useState<ItemForm[]>([
    { description: "", quantity: 1, unit_price: 0, total: 0 }
  ]);
  
  // Inline customer dialog
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showEditCustomerDialog, setShowEditCustomerDialog] = useState(false);
  
  const handleCustomerCreated = (newCustomerId: string) => {
    setCustomerId(newCustomerId);
  };

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: existingItems } = useQuery({
    queryKey: ["quote-items", quote?.id],
    queryFn: async () => {
      if (!quote?.id) return [];
      const { data, error } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quote.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!quote?.id,
  });

  useEffect(() => {
    if (existingItems && existingItems.length > 0) {
      setItems(existingItems.map(item => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total: Number(item.total),
      })));
    }
  }, [existingItems]);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - (discount || 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const selectedCustomer = customers?.find(c => c.id === customerId);
      const autoTitle = selectedCustomer?.name || "Orçamento";

      let quoteId = quote?.id;
      let quoteNumber = quote?.quote_number;

      if (!quoteId) {
        const { data: numberData, error: numberError } = await supabase
          .rpc("generate_quote_number", { _user_id: user.id });
        
        if (numberError) throw numberError;
        quoteNumber = numberData;

        const { data: newQuote, error: createError } = await supabase
          .from("quotes")
          .insert({
            user_id: user.id,
            quote_number: quoteNumber,
            title: autoTitle,
            description,
            customer_id: customerId || null,
            category: category as TablesInsert<"quotes">["category"],
            discount,
            notes,
            valid_until: validUntil || null,
            delivery_date: deliveryDate || null,
            subtotal,
            total,
            status: "draft",
          })
          .select()
          .single();

        if (createError) throw createError;
        quoteId = newQuote.id;
      } else {
        const { error: updateError } = await supabase
          .from("quotes")
          .update({
            title: autoTitle,
            description,
            customer_id: customerId || null,
            category: category as TablesInsert<"quotes">["category"],
            discount,
            notes,
            valid_until: validUntil || null,
            delivery_date: deliveryDate || null,
            subtotal,
            total,
          })
          .eq("id", quoteId);

        if (updateError) throw updateError;

        await supabase.from("quote_items").delete().eq("quote_id", quoteId);
      }

      const itemsToInsert = items
        .filter(item => item.description.trim())
        .map(item => ({
          quote_id: quoteId!,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from("quote_items")
          .insert(itemsToInsert);
        
        if (itemsError) throw itemsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: quote ? "Orçamento atualizado!" : "Orçamento criado!" });
      onSuccess();
    },
    onError: (error) => {
      console.error(error);
      toast({ title: "Erro ao salvar orçamento", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 overflow-hidden">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <Button variant="ghost" onClick={onBack} className="shrink-0 px-2 sm:px-4">
          <ArrowLeft className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
        <h2 className="text-lg sm:text-2xl font-bold truncate">
          {quote ? "Editar Orçamento" : "Novo Orçamento"}
        </h2>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 overflow-hidden">
          <Card className="shadow-card overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Informações do Orçamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="customer">Cliente *</Label>
                  <div className="flex gap-2 min-w-0">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <CustomerSearchSelect
                        customers={customers}
                        value={customerId}
                        onValueChange={setCustomerId}
                        placeholder="Selecione um cliente"
                        allowEmpty={false}
                      />
                    </div>
                    {customerId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setShowEditCustomerDialog(true)}
                        title="Editar cliente"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setShowCustomerDialog(true)}
                        title="Cadastrar novo cliente"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="validUntil">Válido até</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="deliveryDate">Prazo de Entrega</Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição detalhada do serviço..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Itens do Orçamento</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 overflow-hidden">
              <ServiceItemSelector items={items} onItemsChange={setItems} />
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <Card className="shadow-card sticky top-6 overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground text-sm">Subtotal</span>
                <span className="text-sm font-medium truncate">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground text-sm shrink-0">Desconto</span>
                <div className="w-24 sm:w-32">
                  <CurrencyInput
                    value={discount}
                    onChange={setDiscount}
                    className="text-right text-sm"
                  />
                </div>
              </div>
              <div className="border-t pt-4 flex justify-between items-center gap-2 text-base sm:text-lg font-bold">
                <span>Total</span>
                <span className="text-primary truncate">
                  R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <Button 
                className="w-full bg-gradient-primary text-sm sm:text-base" 
                onClick={() => saveMutation.mutate()}
                disabled={!customerId || saveMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <InlineCustomerDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        onCustomerCreated={handleCustomerCreated}
      />
      
      {customerId && (
        <EditCustomerDialog
          customerId={customerId}
          open={showEditCustomerDialog}
          onOpenChange={setShowEditCustomerDialog}
        />
      )}
    </div>
  );
}
