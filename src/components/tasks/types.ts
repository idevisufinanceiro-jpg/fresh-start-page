// Task system types

export interface TaskStatus {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_completed_status: boolean;
  hides_overdue: boolean;
  order_index: number;
  created_at: string;
}

export interface TaskTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  order_index: number;
  created_at: string;
}

export interface TaskTagAssignment {
  id: string;
  task_id: string;
  tag_id: string;
  created_at?: string;
  tag?: TaskTag;
}

export interface Sale {
  id: string;
  sale_number: string;
  customer?: { name: string } | null;
}

export interface Customer {
  id: string;
  name: string;
}

export interface Service {
  id: string;
  title: string;
  customer?: { name: string } | null;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  sale_id: string | null;
  status_id: string | null;
  due_date: string | null;
  notes: string | null;
  contract_url: string | null;
  contract_name: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_time: number | null;
  time_spent: number;
  order_index: number;
  customer_id: string | null;
  service_id: string | null;
  created_at: string;
  updated_at: string;
  status?: TaskStatus | null;
  sale?: Sale | null;
  customer?: Customer | null;
  service?: Service | null;
  tags?: TaskTagAssignment[];
  checklists?: TaskChecklistItem[];
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ViewMode = 'list' | 'table' | 'kanban';

export interface TaskFilters {
  search: string;
  statusId: string | null;
  priority: TaskPriority | null;
  dueDateFilter: 'all' | 'overdue' | 'today' | 'week' | 'no-date';
  customerId: string | null;
  saleId: string | null;
  tagIds: string[];
}

export const PRIORITY_CONFIG = {
  low: {
    label: 'Baixa',
    color: 'hsl(var(--muted-foreground))',
    bgColor: 'hsl(var(--muted))',
    icon: 'minus',
  },
  medium: {
    label: 'Média',
    color: 'hsl(210, 100%, 50%)',
    bgColor: 'hsl(210, 100%, 95%)',
    icon: 'equal',
  },
  high: {
    label: 'Alta',
    color: 'hsl(25, 100%, 50%)',
    bgColor: 'hsl(25, 100%, 95%)',
    icon: 'chevron-up',
  },
  urgent: {
    label: 'Urgente',
    color: 'hsl(0, 100%, 50%)',
    bgColor: 'hsl(0, 100%, 95%)',
    icon: 'alert-triangle',
  },
} as const;

export const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  statusId: null,
  priority: null,
  dueDateFilter: 'all',
  customerId: null,
  saleId: null,
  tagIds: [],
};
