import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface TabOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

interface MobileTabSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: TabOption[];
  className?: string;
}

export function MobileTabSelect({
  value,
  onValueChange,
  options,
  className,
}: MobileTabSelectProps) {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={className}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue>
            <div className="flex items-center gap-2">
              {selectedOption?.icon}
              <span>{selectedOption?.label}</span>
              {selectedOption?.badge}
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="z-50 bg-background">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                {option.icon}
                <span>{option.label}</span>
                {option.badge}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
