import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, ChevronDown, Check, ChevronsUpDown } from "lucide-react";
import { TaskFilters as TaskFiltersType, TaskStatus, TaskTag, Sale, Customer, DEFAULT_FILTERS, PRIORITY_CONFIG, TaskPriority } from "./types";
import { cn } from "@/lib/utils";

interface TaskFiltersProps {
  filters: TaskFiltersType;
  onChange: (filters: TaskFiltersType) => void;
  statuses: TaskStatus[];
  tags: TaskTag[];
  sales: Sale[];
  customers: Customer[];
}

export function TaskFilters({ 
  filters, 
  onChange, 
  statuses, 
  tags, 
  sales, 
  customers 
}: TaskFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [saleSearch, setSaleSearch] = useState("");

  // Filtered lists based on search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    return customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
  }, [customers, customerSearch]);

  const filteredSales = useMemo(() => {
    if (!saleSearch) return sales;
    return sales.filter(s => 
      s.sale_number.toLowerCase().includes(saleSearch.toLowerCase()) ||
      s.customer?.name?.toLowerCase().includes(saleSearch.toLowerCase())
    );
  }, [sales, saleSearch]);
  
  const activeFiltersCount = [
    filters.statusId,
    filters.priority,
    filters.dueDateFilter !== 'all' ? filters.dueDateFilter : null,
    filters.customerId,
    filters.saleId,
    filters.tagIds.length > 0 ? 'tags' : null,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onChange(DEFAULT_FILTERS);
  };

  const updateFilter = <K extends keyof TaskFiltersType>(key: K, value: TaskFiltersType[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tarefas..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="pl-9 pr-8"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={() => updateFilter('search', '')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Quick Status Filter */}
      <Select
        value={filters.statusId || "all"}
        onValueChange={(v) => updateFilter('statusId', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          {statuses.map(status => (
            <SelectItem key={status.id} value={status.id}>
              <div className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: status.color }}
                />
                {status.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Quick Priority Filter */}
      <Select
        value={filters.priority || "all"}
        onValueChange={(v) => updateFilter('priority', v === 'all' ? null : v as TaskPriority)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG[TaskPriority]][]).map(([key, config]) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: config.color }}
                />
                {config.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Advanced Filters */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            <ChevronDown className="h-4 w-4 ml-1" />
            {activeFiltersCount > 0 && (
              <Badge 
                variant="default" 
                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filtros Avançados</h4>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar
                </Button>
              )}
            </div>

            {/* Due Date Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Prazo</label>
              <Select
                value={filters.dueDateFilter}
                onValueChange={(v) => updateFilter('dueDateFilter', v as TaskFiltersType['dueDateFilter'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="overdue">Atrasadas</SelectItem>
                  <SelectItem value="today">Vence hoje</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="no-date">Sem prazo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer Filter - Searchable */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Cliente</label>
              <Popover open={customerOpen} onOpenChange={(open) => {
                setCustomerOpen(open);
                if (!open) setCustomerSearch("");
              }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerOpen}
                    className="w-full justify-between font-normal"
                  >
                    {filters.customerId
                      ? customers.find(c => c.id === filters.customerId)?.name || "Cliente"
                      : "Todos os clientes"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Buscar cliente..." 
                      value={customerSearch}
                      onValueChange={setCustomerSearch}
                    />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            updateFilter('customerId', null);
                            setCustomerOpen(false);
                            setCustomerSearch("");
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !filters.customerId ? "opacity-100" : "opacity-0")} />
                          Todos os clientes
                        </CommandItem>
                        {filteredCustomers.map(customer => (
                          <CommandItem
                            key={customer.id}
                            value={customer.id}
                            onSelect={() => {
                              updateFilter('customerId', customer.id);
                              setCustomerOpen(false);
                              setCustomerSearch("");
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", filters.customerId === customer.id ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{customer.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Sale Filter - Searchable */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Venda</label>
              <Popover open={saleOpen} onOpenChange={(open) => {
                setSaleOpen(open);
                if (!open) setSaleSearch("");
              }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={saleOpen}
                    className="w-full justify-between font-normal"
                  >
                    {filters.saleId
                      ? (() => {
                          const sale = sales.find(s => s.id === filters.saleId);
                          return sale ? `${sale.sale_number} - ${sale.customer?.name || "Sem cliente"}` : "Venda";
                        })()
                      : "Todas as vendas"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Buscar venda..." 
                      value={saleSearch}
                      onValueChange={setSaleSearch}
                    />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>Nenhuma venda encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            updateFilter('saleId', null);
                            setSaleOpen(false);
                            setSaleSearch("");
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !filters.saleId ? "opacity-100" : "opacity-0")} />
                          Todas as vendas
                        </CommandItem>
                        {filteredSales.map(sale => (
                          <CommandItem
                            key={sale.id}
                            value={sale.id}
                            onSelect={() => {
                              updateFilter('saleId', sale.id);
                              setSaleOpen(false);
                              setSaleSearch("");
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", filters.saleId === sale.id ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{sale.sale_number} - {sale.customer?.name || "Sem cliente"}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => {
                    const isSelected = filters.tagIds.includes(tag.id);
                    return (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className={cn(
                          "cursor-pointer transition-colors",
                          isSelected && "border-2"
                        )}
                        style={{ 
                          borderColor: tag.color,
                          backgroundColor: isSelected ? `${tag.color}20` : 'transparent',
                          color: tag.color
                        }}
                        onClick={() => {
                          const newTagIds = isSelected
                            ? filters.tagIds.filter(id => id !== tag.id)
                            : [...filters.tagIds, tag.id];
                          updateFilter('tagIds', newTagIds);
                        }}
                      >
                        {tag.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
