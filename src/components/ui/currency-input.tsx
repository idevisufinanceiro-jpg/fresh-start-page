import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
}

// Formata número para moeda brasileira (display)
function formatCurrencyDisplay(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Converte string formatada para número
function parseCurrencyValue(formattedValue: string): number {
  // Remove tudo exceto números
  const digits = formattedValue.replace(/\D/g, "");
  
  if (!digits) return 0;
  
  // Converte para centavos e depois para reais
  const cents = parseInt(digits, 10);
  return cents / 100;
}

export function CurrencyInput({
  value,
  onChange,
  className,
  ...props
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState(() => formatCurrencyDisplay(value));

  // Atualiza display quando valor externo muda
  React.useEffect(() => {
    setDisplayValue(formatCurrencyDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const numericValue = parseCurrencyValue(inputValue);
    
    // Limita a valores razoáveis (máximo 999.999.999,99)
    if (numericValue > 999999999.99) return;
    
    setDisplayValue(formatCurrencyDisplay(numericValue));
    onChange(numericValue);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Seleciona todo o texto ao focar
    e.target.select();
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
        R$
      </span>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        className={cn("pl-9 text-right", className)}
      />
    </div>
  );
}
