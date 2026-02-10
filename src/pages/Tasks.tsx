import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTasksRealtime } from "@/hooks/useTasksRealtime";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import { TasksStats } from "@/components/tasks/TasksStats";
import { TaskStatusManager } from "@/components/tasks/TaskStatusManager";
import { TasksKanbanView } from "@/components/tasks/TasksKanbanView";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { TaskViewToggle } from "@/components/tasks/TaskViewToggle";
import { TaskQuickCreate } from "@/components/tasks/TaskQuickCreate";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";
import { TaskBulkActions } from "@/components/tasks/TaskBulkActions";
import { TasksTableView } from "@/components/tasks/TasksTableView";
import { TasksListView } from "@/components/tasks/TasksListView";
import { Task, TaskStatus, TaskTag, ViewMode, TaskFilters as TaskFiltersType, DEFAULT_FILTERS, Sale, Customer, Service } from "@/components/tasks/types";
import { isToday, startOfDay, isThisWeek } from "date-fns";
import { parseDateOnly } from "@/lib/dateOnly";
import { TasksSkeleton } from "@/components/ui/page-skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function Tasks() {
  const { user } = useAuth();
  
  // Realtime updates para tarefas
  useTasksRealtime();
  
  const [showStatusManager, setShowStatusManager] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("tasks-view-mode") as ViewMode) || "table";
  });
  const [filters, setFilters] = useState<TaskFiltersType>(DEFAULT_FILTERS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const quickCreateRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Save view mode to localStorage
  useEffect(() => {
    localStorage.setItem("tasks-view-mode", viewMode);
  }, [viewMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'n': // New task
            e.preventDefault();
            quickCreateRef.current?.focus();
            break;
          case 'f': // Search/filter
            e.preventDefault();
            searchInputRef.current?.focus();
            break;
        }
      }
      
      // Number keys 1-3 for view mode (without ctrl/cmd)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '1') setViewMode('table');
        if (e.key === '2') setViewMode('kanban');
        if (e.key === '3') setViewMode('list');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch task statuses
  const { data: statuses = [] } = useQuery<TaskStatus[]>({
    queryKey: ["task-statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_statuses")
        .select("*")
        .order("order_index");
      if (error) throw error;
      return data as TaskStatus[];
    },
    enabled: !!user,
  });

  // Fetch tags
  const { data: tags = [] } = useQuery<TaskTag[]>({
    queryKey: ["task-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_tags")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as TaskTag[];
    },
    enabled: !!user,
  });

  // Fetch tasks with relations
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          status:task_statuses(*),
          sale:sales(id, sale_number, customer:customers(name)),
          customer:customers(id, name),
          service:services(id, title),
          tags:task_tag_assignments(id, task_id, tag_id, tag:task_tags(*)),
          checklists:task_checklists(*)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user,
  });

  // Fetch sales
  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: ["sales-for-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_number, customer:customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!user,
  });

  // Fetch customers
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-for-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!user,
  });

  // Fetch services
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["services-for-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, title")
        .order("title");
      if (error) throw error;
      return data as Service[];
    },
    enabled: !!user,
  });

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    // Search filter
    if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    // Status filter
    if (filters.statusId && task.status_id !== filters.statusId) {
      return false;
    }
    // Priority filter
    if (filters.priority && task.priority !== filters.priority) {
      return false;
    }
    // Due date filter
    if (filters.dueDateFilter !== 'all') {
      // DATE "YYYY-MM-DD" precisa ser interpretada como data local (sem shift de timezone)
      const due = task.due_date ? parseDateOnly(task.due_date) : null;
      const dueDate = due ? startOfDay(due) : null;
      const today = startOfDay(new Date());
      const shouldHideOverdue = task.status?.hides_overdue || task.status?.is_completed_status;
      
      if (filters.dueDateFilter === 'overdue') {
        // Considera status que escondem atrasado
        if (!dueDate || dueDate >= today || shouldHideOverdue) return false;
      }
      if (filters.dueDateFilter === 'today' && (!due || !isToday(due))) return false;
      if (filters.dueDateFilter === 'week' && (!due || !isThisWeek(due))) return false;
      if (filters.dueDateFilter === 'no-date' && dueDate) return false;
    }
    // Customer filter
    if (filters.customerId && task.customer_id !== filters.customerId) {
      return false;
    }
    // Sale filter
    if (filters.saleId && task.sale_id !== filters.saleId) {
      return false;
    }
    // Tags filter
    if (filters.tagIds.length > 0) {
      const taskTagIds = task.tags?.map(t => t.tag_id) || [];
      if (!filters.tagIds.some(id => taskTagIds.includes(id))) return false;
    }
    return true;
  });

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  if (isLoading) {
    return <TasksSkeleton viewMode={viewMode} />;
  }

  return (
    <div className="space-y-6 overflow-x-hidden w-full max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl md:text-3xl font-bold truncate">Tarefas</h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground hidden md:inline">(1/2/3 trocar view, Ctrl+N nova)</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Atalhos: 1=Tabela, 2=Kanban, 3=Lista</p>
                <p>Ctrl+N = Nova tarefa, Ctrl+F = Buscar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <TaskViewToggle view={viewMode} onChange={setViewMode} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStatusManager(!showStatusManager)}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Status</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <TasksStats tasks={tasks} />

      {/* Status Manager */}
      {showStatusManager && <TaskStatusManager statuses={statuses} />}

      {/* Quick Create */}
      <TaskQuickCreate statuses={statuses} />

      {/* Filters */}
      <TaskFilters
        filters={filters}
        onChange={setFilters}
        statuses={statuses}
        tags={tags}
        sales={sales}
        customers={customers}
      />

      {/* Bulk Actions */}
      <TaskBulkActions
        selectedIds={selectedIds}
        tasks={filteredTasks}
        statuses={statuses}
        onClearSelection={() => setSelectedIds([])}
      />

      {/* Task Views */}
      {viewMode === "kanban" && (
        <TasksKanbanView
          tasks={filteredTasks}
          statuses={statuses}
          onOpenDetail={setSelectedTaskId}
        />
      )}
      {viewMode === "table" && (
        <TasksTableView
          tasks={filteredTasks}
          statuses={statuses}
          sales={sales}
          viewMode={viewMode}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onOpenDetail={setSelectedTaskId}
        />
      )}
      {viewMode === "list" && (
        <TasksListView
          tasks={filteredTasks}
          statuses={statuses}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onOpenDetail={setSelectedTaskId}
        />
      )}

      {/* Detail Sheet */}
      <TaskDetailSheet
        task={selectedTask}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        statuses={statuses}
        sales={sales}
        customers={customers}
        services={services}
      />
    </div>
  );
}
