import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Trash2, Package, ChevronsUpDown, Check, Copy, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { InlineServiceTypeDialog } from "@/components/shared/InlineServiceTypeDialog";

export interface ItemForm {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  baseServiceName?: string; // Nome base do serviço selecionado
}

interface ServiceItemSelectorProps {
  items: ItemForm[];
  onItemsChange: (items: ItemForm[]) => void;
}

export function ServiceItemSelector({ items, onItemsChange }: ServiceItemSelectorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openPopovers, setOpenPopovers] = useState<Record<number, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [pendingServiceIndex, setPendingServiceIndex] = useState<number | null>(null);

  const { data: serviceTypes } = useQuery({
    queryKey: ["service-types-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_types")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updateItem = (index: number, field: keyof ItemForm, value: string | number) => {
    const newItems = [...items];
    const item = newItems[index];
    
    if (field === "description") {
      item.description = value as string;
    } else if (field === "quantity") {
      item.quantity = Number(value) || 0;
      item.total = item.quantity * item.unit_price;
    } else if (field === "unit_price") {
      item.unit_price = Number(value) || 0;
      item.total = item.quantity * item.unit_price;
    } else if (field === "total") {
      item.total = Number(value) || 0;
      // Recalculate unit_price based on total if quantity > 0
      if (item.quantity > 0) {
        item.unit_price = item.total / item.quantity;
      }
    }
    
    onItemsChange(newItems);
  };

  const selectServiceType = (index: number, serviceTypeId: string) => {
    const serviceType = serviceTypes?.find(s => s.id === serviceTypeId);
    if (serviceType) {
      const newItems = [...items];
      const currentItem = newItems[index];
      
      // Se já tinha uma descrição adicional além do nome base anterior, preserva ela
      let additionalDescription = "";
      if (currentItem.baseServiceName && currentItem.description.startsWith(currentItem.baseServiceName)) {
        additionalDescription = currentItem.description.slice(currentItem.baseServiceName.length).trim();
        if (additionalDescription.startsWith("-")) {
          additionalDescription = additionalDescription.slice(1).trim();
        }
      }
      
      newItems[index] = {
        ...currentItem,
        description: additionalDescription 
          ? `${serviceType.name} - ${additionalDescription}`
          : serviceType.name,
        baseServiceName: serviceType.name,
        unit_price: serviceType.default_price || 0,
        total: currentItem.quantity * (serviceType.default_price || 0),
      };
      onItemsChange(newItems);
      setOpenPopovers(prev => ({ ...prev, [index]: false }));
      // Auto-expand the item after selecting
      setExpandedItems(prev => ({ ...prev, [index]: true }));
    }
  };

  const addItem = () => {
    const newIndex = items.length;
    onItemsChange([...items, { description: "", quantity: 1, unit_price: 0, total: 0 }]);
    // Auto-expand new item
    setExpandedItems(prev => ({ ...prev, [newIndex]: true }));
  };

  const duplicateItem = (index: number) => {
    const itemToDuplicate = items[index];
    const newItem = { ...itemToDuplicate, id: undefined };
    const newItems = [...items];
    newItems.splice(index + 1, 0, newItem);
    onItemsChange(newItems);
    // Auto-expand duplicated item
    setExpandedItems(prev => ({ ...prev, [index + 1]: true }));
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      onItemsChange(items.filter((_, i) => i !== index));
    }
  };

  const toggleExpanded = (index: number) => {
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const openNewServiceDialog = (index: number) => {
    setPendingServiceIndex(index);
    setShowServiceDialog(true);
    setOpenPopovers(prev => ({ ...prev, [index]: false }));
  };

  const handleServiceCreated = (serviceId: string, serviceName: string, defaultPrice: number) => {
    if (pendingServiceIndex !== null) {
      const newItems = [...items];
      newItems[pendingServiceIndex] = {
        ...newItems[pendingServiceIndex],
        description: serviceName,
        baseServiceName: serviceName,
        unit_price: defaultPrice,
        total: newItems[pendingServiceIndex].quantity * defaultPrice,
      };
      onItemsChange(newItems);
      setExpandedItems(prev => ({ ...prev, [pendingServiceIndex]: true }));
    }
    setPendingServiceIndex(null);
  };

  return (
    <div className="space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium shrink-0">Itens</label>
        <Button type="button" variant="outline" size="sm" onClick={addItem} className="shrink-0">
          <Plus className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <Collapsible
            key={index}
            open={expandedItems[index]}
            onOpenChange={() => toggleExpanded(index)}
          >
          <div className="rounded-lg border bg-card overflow-hidden">
              {/* Header - Always visible */}
              <div className="p-2 sm:p-3 flex items-center gap-1 sm:gap-2">
                <div className="flex-1 min-w-0 overflow-hidden">
                  {serviceTypes && serviceTypes.length > 0 && (
                    <Popover 
                      open={openPopovers[index]} 
                      onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, [index]: open }))}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openPopovers[index]}
                          className="w-full justify-between min-w-0 max-w-full px-2 sm:px-3"
                        >
                          <span className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1 overflow-hidden">
                            <Package className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                            <span className="truncate text-xs sm:text-sm">
                              {item.description || "Selecionar servi..."}
                            </span>
                          </span>
                          <ChevronsUpDown className="ml-1 h-3 w-3 sm:h-4 sm:w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] sm:w-[300px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar serviço por nome..." />
                          <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                            <CommandGroup>
                              {serviceTypes.map((service) => (
                                <CommandItem
                                  key={service.id}
                                  value={service.name}
                                  onSelect={() => selectServiceType(index, service.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 shrink-0 text-primary",
                                      item.description === service.name ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                                    <span className="truncate font-medium text-foreground">{service.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatCurrency(service.default_price || 0)}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                          <div className="border-t p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => openNewServiceDialog(index)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Cadastrar novo serviço
                            </Button>
                          </div>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* Total display */}
                <div className="text-right shrink-0 min-w-[60px] sm:min-w-[80px]">
                  <span className="font-semibold text-primary text-xs sm:text-sm">{formatCurrency(item.total)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center shrink-0">
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8"
                    >
                      {expandedItems[index] ? (
                        <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" />
                      ) : (
                        <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 hidden sm:flex"
                    onClick={() => duplicateItem(index)}
                    title="Duplicar item"
                  >
                    <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {/* Expanded Content - Editable fields */}
              <CollapsibleContent>
                <div className="px-4 pb-4 pt-2 border-t bg-muted/30 space-y-4">
                  {/* Description adicional */}
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium">
                      {item.baseServiceName ? "Descrição Adicional" : "Descrição do Serviço"}
                    </label>
                    {item.baseServiceName && (
                      <p className="text-sm font-medium text-foreground mb-1">
                        {item.baseServiceName}
                      </p>
                    )}
                    <Textarea
                      value={
                        item.baseServiceName && item.description.startsWith(item.baseServiceName)
                          ? item.description
                              .slice(item.baseServiceName.length)
                              .replace(/^\s*-\s*/, "")
                          : item.description
                      }
                      onChange={(e) => {
                        const additionalText = e.target.value;
                        const newDescription = item.baseServiceName
                          ? additionalText.length > 0
                            ? `${item.baseServiceName} - ${additionalText}`
                            : item.baseServiceName
                          : e.target.value;
                        updateItem(index, "description", newDescription);
                      }}
                      placeholder={
                        item.baseServiceName
                          ? "Adicione detalhes específicos (ex: cores, tamanhos, especificações)..."
                          : "Descrição detalhada do serviço..."
                      }
                      rows={2}
                    />
                  </div>

                  {/* Quantity, Unit Price, Total */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground font-medium">Quantidade</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground font-medium">Valor Unitário</label>
                      <CurrencyInput
                        value={item.unit_price}
                        onChange={(value) => updateItem(index, "unit_price", value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground font-medium">Total</label>
                      <CurrencyInput
                        value={item.total}
                        onChange={(value) => updateItem(index, "total", value)}
                        className="font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
      
      <InlineServiceTypeDialog
        open={showServiceDialog}
        onOpenChange={setShowServiceDialog}
        onServiceCreated={handleServiceCreated}
      />
    </div>
  );
}
