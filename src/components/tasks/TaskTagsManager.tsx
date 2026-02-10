import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X, Tag, Check } from "lucide-react";
import { toast } from "sonner";
import { TaskTag, TaskTagAssignment } from "./types";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", 
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"
];

interface TaskTagsManagerProps {
  taskId: string;
  assignedTags: TaskTagAssignment[];
}

export function TaskTagsManager({ taskId, assignedTags }: TaskTagsManagerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);

  // Fetch all available tags
  const { data: allTags = [] } = useQuery({
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

  const assignedTagIds = assignedTags.map(at => at.tag_id);

  // Create new tag
  const createTag = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from("task_tags")
        .insert({ user_id: user!.id, name, color })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ["task-tags"] });
      setNewTagName("");
      // Auto-assign the newly created tag
      assignTag.mutate(newTag.id);
    },
    onError: () => toast.error("Erro ao criar tag"),
  });

  // Assign tag to task
  const assignTag = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from("task_tag_assignments")
        .insert({ task_id: taskId, tag_id: tagId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast.error("Erro ao adicionar tag"),
  });

  // Remove tag from task
  const removeTag = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from("task_tag_assignments")
        .delete()
        .eq("task_id", taskId)
        .eq("tag_id", tagId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast.error("Erro ao remover tag"),
  });

  // Delete tag entirely
  const deleteTag = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from("task_tags")
        .delete()
        .eq("id", tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-tags"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tag excluída");
    },
    onError: () => toast.error("Erro ao excluir tag"),
  });

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    createTag.mutate({ name: newTagName.trim(), color: newTagColor });
  };

  const handleToggleTag = (tagId: string) => {
    if (assignedTagIds.includes(tagId)) {
      removeTag.mutate(tagId);
    } else {
      assignTag.mutate(tagId);
    }
  };

  return (
    <div className="space-y-2">
      {/* Assigned tags display */}
      <div className="flex flex-wrap gap-1.5">
        {assignedTags.map(assignment => {
          const tag = allTags.find(t => t.id === assignment.tag_id);
          if (!tag) return null;
          return (
            <Badge
              key={assignment.id}
              variant="outline"
              className="gap-1 pr-1"
              style={{ 
                borderColor: tag.color,
                backgroundColor: `${tag.color}15`,
                color: tag.color
              }}
            >
              {tag.name}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeTag.mutate(tag.id)}
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </Badge>
          );
        })}

        {/* Add tag button */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Gerenciar Tags</h4>

              {/* Existing tags */}
              {allTags.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {allTags.map(tag => {
                    const isAssigned = assignedTagIds.includes(tag.id);
                    return (
                      <div
                        key={tag.id}
                        className={cn(
                          "flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted transition-colors",
                          isAssigned && "bg-muted"
                        )}
                        onClick={() => handleToggleTag(tag.id)}
                      >
                        <div 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm flex-1 truncate">{tag.name}</span>
                        {isAssigned && <Check className="h-4 w-4 text-primary" />}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-50 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTag.mutate(tag.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Create new tag */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs text-muted-foreground">Criar nova tag</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da tag"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                    className="text-sm h-8"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      className={cn(
                        "w-5 h-5 rounded-full transition-transform",
                        newTagColor === color && "ring-2 ring-offset-2 ring-primary scale-110"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewTagColor(color)}
                    />
                  ))}
                </div>
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                >
                  <Tag className="h-3 w-3 mr-1" />
                  Criar Tag
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
