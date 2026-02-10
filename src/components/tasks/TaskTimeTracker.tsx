import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Play, Pause, Clock, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TaskTimeTrackerProps {
  taskId: string;
  estimatedTime: number | null;
  timeSpent: number;
}

export function TaskTimeTracker({ taskId, estimatedTime, timeSpent }: TaskTimeTrackerProps) {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const updateTime = useMutation({
    mutationFn: async (updates: { estimated_time?: number | null; time_spent?: number }) => {
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast.error("Erro ao atualizar tempo"),
  });

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStopTimer = () => {
    setIsRunning(false);
    const minutesToAdd = Math.ceil(sessionTime / 60);
    if (minutesToAdd > 0) {
      updateTime.mutate({ time_spent: timeSpent + minutesToAdd });
    }
    setSessionTime(0);
  };

  const handleAddTime = (minutes: number) => {
    const newTime = Math.max(0, timeSpent + minutes);
    updateTime.mutate({ time_spent: newTime });
  };

  const handleUpdateEstimated = (minutes: number | null) => {
    updateTime.mutate({ estimated_time: minutes });
  };

  const progress = estimatedTime && estimatedTime > 0 
    ? Math.min(100, (timeSpent / estimatedTime) * 100) 
    : 0;
  const isOvertime = estimatedTime && timeSpent > estimatedTime;

  return (
    <div className="space-y-3">
      {/* Timer display */}
      <div className="flex items-center gap-3">
        <Button
          variant={isRunning ? "destructive" : "default"}
          size="sm"
          onClick={() => isRunning ? handleStopTimer() : setIsRunning(true)}
          className="gap-1.5"
        >
          {isRunning ? (
            <>
              <Pause className="h-3.5 w-3.5" />
              Parar
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Iniciar
            </>
          )}
        </Button>

        {isRunning && (
          <div className="text-lg font-mono font-medium text-primary animate-pulse">
            {formatSeconds(sessionTime)}
          </div>
        )}
      </div>

      {/* Time spent vs estimated */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Tempo gasto:</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleAddTime(-15)}
              disabled={timeSpent < 15 || isRunning}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    "h-6 px-2 min-w-[60px]",
                    isOvertime && "text-destructive"
                  )}
                  disabled={isRunning}
                >
                  {formatTime(timeSpent)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48" align="center">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Definir tempo (minutos)</p>
                  <Input
                    type="number"
                    placeholder="Ex: 30"
                    defaultValue={timeSpent}
                    min={0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        updateTime.mutate({ time_spent: value });
                      }
                    }}
                    className="h-8"
                  />
                  <div className="flex flex-wrap gap-1">
                    {[0, 15, 30, 60, 120].map(mins => (
                      <Button
                        key={mins}
                        variant="outline"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={() => updateTime.mutate({ time_spent: mins })}
                      >
                        {formatTime(mins)}
                      </Button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleAddTime(15)}
              disabled={isRunning}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Estimated time */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estimado:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2">
                <Clock className="h-3 w-3 mr-1" />
                {estimatedTime ? formatTime(estimatedTime) : "Definir"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Tempo estimado (minutos)</p>
                <Input
                  type="number"
                  placeholder="Ex: 60"
                  defaultValue={estimatedTime || ""}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    handleUpdateEstimated(isNaN(value) ? null : value);
                  }}
                  className="h-8"
                />
                <div className="flex flex-wrap gap-1">
                  {[15, 30, 60, 120, 240].map(mins => (
                    <Button
                      key={mins}
                      variant="outline"
                      size="sm"
                      className="text-xs h-6 px-2"
                      onClick={() => handleUpdateEstimated(mins)}
                    >
                      {formatTime(mins)}
                    </Button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Progress bar */}
        {estimatedTime && estimatedTime > 0 && (
          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all",
                  isOvertime ? "bg-destructive" : "bg-primary"
                )}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {progress.toFixed(0)}%
              {isOvertime && " (excedido)"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
