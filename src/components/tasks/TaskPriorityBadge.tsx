import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronUp, Equal, Minus } from "lucide-react";
import { TaskPriority, PRIORITY_CONFIG } from "./types";
import { cn } from "@/lib/utils";

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  showLabel?: boolean;
  size?: "sm" | "default";
  className?: string;
}

export function TaskPriorityBadge({ 
  priority, 
  showLabel = true, 
  size = "default",
  className 
}: TaskPriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];
  
  const Icon = {
    'minus': Minus,
    'equal': Equal,
    'chevron-up': ChevronUp,
    'alert-triangle': AlertTriangle,
  }[config.icon];

  return (
    <Badge 
      variant="outline"
      className={cn(
        "gap-1 font-medium border-0",
        size === "sm" && "text-xs px-1.5 py-0",
        className
      )}
      style={{ 
        backgroundColor: config.bgColor,
        color: config.color 
      }}
    >
      <Icon className={cn("shrink-0", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {showLabel && config.label}
    </Badge>
  );
}
