import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Database, Paperclip, FileText, Image, File, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";

interface TableCount {
  name: string;
  count: number;
  icon: React.ReactNode;
  color: string;
}

interface StorageFile {
  name: string;
  size: number;
  bucket: string;
  path: string;
  created_at?: string;
  publicUrl?: string;
}

interface StorageDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "database" | "files";
  tableCounts?: TableCount[];
}

export function StorageDetailsDialog({
  open,
  onOpenChange,
  type,
  tableCounts = [],
}: StorageDetailsDialogProps) {
  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ["storage-files-list"],
    queryFn: async () => {
      const allFiles: StorageFile[] = [];
      
      // Helper function to get public URL for a file
      const getPublicUrl = (bucketName: string, path: string): string => {
        const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
        return data.publicUrl;
      };
      
      // Helper function to recursively list files in a bucket
      const listFilesInBucket = async (bucketName: string, path: string = ""): Promise<StorageFile[]> => {
        const files: StorageFile[] = [];
        
        try {
          const { data: items } = await supabase.storage
            .from(bucketName)
            .list(path, { limit: 1000 });
          
          if (items) {
            for (const item of items) {
              const fullPath = path ? `${path}/${item.name}` : item.name;
              
              if (item.id) {
                // It's a file - get public URL for public buckets
                const isPublicBucket = bucketName === "contracts" || bucketName === "branding";
                files.push({
                  name: item.name,
                  size: item.metadata?.size || 0,
                  bucket: bucketName,
                  path: fullPath,
                  created_at: item.created_at,
                  publicUrl: isPublicBucket ? getPublicUrl(bucketName, fullPath) : undefined,
                });
              } else {
                // It's a folder, recurse
                const subFiles = await listFilesInBucket(bucketName, fullPath);
                files.push(...subFiles);
              }
            }
          }
        } catch (error) {
          console.log(`Error listing ${bucketName}/${path}:`, error);
        }
        
        return files;
      };
      
      // Get files from all buckets
      const [attachmentsFiles, contractsFiles, brandingFiles] = await Promise.all([
        listFilesInBucket("attachments"),
        listFilesInBucket("contracts"),
        listFilesInBucket("branding"),
      ]);
      
      allFiles.push(...attachmentsFiles, ...contractsFiles, ...brandingFiles);
      
      // Sort by size descending
      return allFiles.sort((a, b) => b.size - a.size);
    },
    enabled: open && type === "files",
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const isImageFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return <Image className="h-4 w-4 text-blue-500" />;
    }
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) {
      return <FileText className="h-4 w-4 text-orange-500" />;
    }
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const getBucketLabel = (bucket: string) => {
    switch (bucket) {
      case "attachments": return "Anexos";
      case "contracts": return "Contratos";
      case "branding": return "Logos";
      default: return bucket;
    }
  };

  const getBucketColor = (bucket: string) => {
    switch (bucket) {
      case "attachments": return "bg-blue-500/10 text-blue-600";
      case "contracts": return "bg-purple-500/10 text-purple-600";
      case "branding": return "bg-green-500/10 text-green-600";
      default: return "bg-gray-500/10 text-gray-600";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "database" ? (
              <>
                <Database className="h-5 w-5 text-primary" />
                Detalhes do Banco de Dados
              </>
            ) : (
              <>
                <Paperclip className="h-5 w-5 text-primary" />
                Arquivos Armazenados
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {type === "database"
              ? "Lista de registros por tipo no banco de dados"
              : "Lista de arquivos que consomem espaço de armazenamento"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {type === "database" ? (
            <div className="space-y-2">
              {tableCounts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum registro encontrado
                </p>
              ) : (
                tableCounts
                  .sort((a, b) => b.count - a.count)
                  .map((table) => (
                    <div
                      key={table.name}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={table.color}>{table.icon}</div>
                        <span className="text-sm font-medium">{table.name}</span>
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        {table.count.toLocaleString()}
                      </Badge>
                    </div>
                  ))
              )}
            </div>
          ) : filesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !files || files.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum arquivo encontrado
            </p>
          ) : (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.bucket}-${file.path}-${index}`}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Show thumbnail for images if we have a public URL */}
                    {isImageFile(file.name) && file.publicUrl ? (
                      <div className="relative h-10 w-10 rounded overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={file.publicUrl}
                          alt={file.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            // Fallback to icon if image fails to load
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        {getFileIcon(file.name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {file.path}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {file.publicUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => window.open(file.publicUrl, '_blank')}
                        title="Abrir arquivo"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Badge className={getBucketColor(file.bucket)} variant="outline">
                      {getBucketLabel(file.bucket)}
                    </Badge>
                    <Badge variant="secondary" className="font-mono">
                      {formatBytes(file.size)}
                    </Badge>
                  </div>
                </div>
              ))}
              
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total de arquivos:</span>
                  <span className="font-medium">{files.length}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Tamanho total:</span>
                  <span className="font-medium">
                    {formatBytes(files.reduce((sum, f) => sum + f.size, 0))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
