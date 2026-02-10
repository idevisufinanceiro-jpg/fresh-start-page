import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { Upload, FileText, Image, Trash2, Download, Loader2, File } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Attachment = Tables<"attachments">;

interface AttachmentManagerProps {
  serviceId: string;
}

const getFileIcon = (fileType: string | null) => {
  if (!fileType) return <File className="h-8 w-8" />;
  if (fileType.startsWith("image/")) return <Image className="h-8 w-8 text-green-500" />;
  if (fileType === "application/pdf") return <FileText className="h-8 w-8 text-red-500" />;
  return <File className="h-8 w-8 text-blue-500" />;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Extract the storage path from the file_url
const getStoragePath = (fileUrl: string): string | null => {
  try {
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split("/storage/v1/object/public/attachments/");
    if (pathParts[1]) {
      return decodeURIComponent(pathParts[1]);
    }
    // Try signed URL format
    const signedParts = url.pathname.split("/storage/v1/object/sign/attachments/");
    if (signedParts[1]) {
      return decodeURIComponent(signedParts[1].split("?")[0]);
    }
  } catch {
    return null;
  }
  return null;
};

export function AttachmentManager({ serviceId }: AttachmentManagerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Generate signed URL for download (valid for 1 hour)
  const getSignedUrl = useCallback(async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(filePath, 3600); // 1 hour
    
    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }
    return data.signedUrl;
  }, []);

  const { data: attachments, isLoading } = useQuery({
    queryKey: ["attachments", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("service_id", serviceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Generate signed URLs for all attachments
      const urls: Record<string, string> = {};
      for (const attachment of data || []) {
        // Use service-based path (shared across users)
        const storagePath = `services/${serviceId}/${attachment.file_url.split("/").pop()}`;
        const signedUrl = await getSignedUrl(storagePath);
        if (signedUrl) {
          urls[attachment.id] = signedUrl;
        }
      }
      setSignedUrls(urls);
      
      return data as Attachment[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Usuário não autenticado");

      const fileExt = file.name.split(".").pop();
      // Use service-based path (shared across users)
      const fileName = `services/${serviceId}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Save to database with the storage path (not public URL)
      const { error: dbError } = await supabase.from("attachments").insert({
        user_id: user.id,
        service_id: serviceId,
        file_url: fileName, // Store the path, not the public URL
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", serviceId] });
      toast({ title: "Arquivo enviado com sucesso" });
    },
    onError: (error) => {
      console.error("Upload error:", error);
      toast({ title: "Erro ao enviar arquivo", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachment: Attachment) => {
      // The file_url now contains the storage path directly
      const storagePath = attachment.file_url.includes("storage/v1")
        ? getStoragePath(attachment.file_url)
        : attachment.file_url;
      
      if (storagePath) {
        await supabase.storage.from("attachments").remove([storagePath]);
      }

      const { error } = await supabase
        .from("attachments")
        .delete()
        .eq("id", attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", serviceId] });
      toast({ title: "Arquivo removido" });
    },
    onError: () => {
      toast({ title: "Erro ao remover arquivo", variant: "destructive" });
    },
  });

  const handleDownload = async (attachment: Attachment) => {
    let url = signedUrls[attachment.id];
    
    if (!url) {
      // Generate new signed URL if not cached
      const storagePath = attachment.file_url.includes("storage/v1")
        ? getStoragePath(attachment.file_url)
        : attachment.file_url;
      
      if (storagePath) {
        url = await getSignedUrl(storagePath) || "";
      }
    }
    
    if (url) {
      window.open(url, "_blank");
    } else {
      toast({ title: "Erro ao acessar arquivo", variant: "destructive" });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadMutation.mutateAsync(file);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Arquivos</span>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Enviar Arquivo
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        <div className="space-y-2">
          {attachments?.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              {getFileIcon(attachment.file_type)}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.file_size)} • {format(new Date(attachment.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(attachment)}
                  title="Baixar arquivo"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(attachment)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {attachments?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum arquivo anexado</p>
              <p className="text-sm">Clique em "Enviar Arquivo" para adicionar</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
