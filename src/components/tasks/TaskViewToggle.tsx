import { LayoutGrid, List, Table2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ViewMode } from "./types";
import { cn } from "@/lib/utils";

interface TaskViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
  className?: string;
}

export function TaskViewToggle({ view, onChange, className }: TaskViewToggleProps) {
  return (
    <ToggleGroup 
      type="single" 
      value={view} 
      onValueChange={(v) => v && onChange(v as ViewMode)}
      className={cn("border rounded-lg p-1 bg-muted", className)}
    >
      <ToggleGroupItem 
        value="list" 
        aria-label="Visualização em lista"
        className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=off]:text-foreground px-3"
      >
        <List className="h-4 w-4 mr-1.5" />
        <span className="hidden sm:inline text-sm">Lista</span>
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="table" 
        aria-label="Visualização em tabela"
        className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=off]:text-foreground px-3"
      >
        <Table2 className="h-4 w-4 mr-1.5" />
        <span className="hidden sm:inline text-sm">Tabela</span>
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="kanban" 
        aria-label="Visualização Kanban"
        className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=off]:text-foreground px-3"
      >
        <LayoutGrid className="h-4 w-4 mr-1.5" />
        <span className="hidden sm:inline text-sm">Kanban</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
