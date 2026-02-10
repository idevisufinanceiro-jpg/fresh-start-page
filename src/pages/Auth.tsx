import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, Palette, Film, Sparkles, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const result = loginSchema.safeParse(formData);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        setLoading(false);
        return;
      }

      const { error } = await signIn(formData.email, formData.password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            variant: 'destructive',
            title: 'Erro ao entrar',
            description: 'Email ou senha incorretos',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Erro ao entrar',
            description: error.message,
          });
        }
      } else {
        toast({
          title: 'Bem-vindo!',
          description: 'Login realizado com sucesso',
        });
        navigate('/');
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Ocorreu um erro inesperado',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white">Gestão Criativa</h1>
          <p className="text-white/80 mt-2">Gestão completa para profissionais criativos</p>
        </div>
        
        <div className="space-y-8 relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            Gerencie seus projetos criativos com eficiência e elegância.
          </h2>
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Camera className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Fotografia & Filmagem</h3>
              <p className="text-white/70 text-sm">Gerencie seus projetos audiovisuais</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Palette className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Design Gráfico</h3>
              <p className="text-white/70 text-sm">Organize identidades visuais e artes</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Film className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Motion Design</h3>
              <p className="text-white/70 text-sm">Controle projetos de animação e vídeo</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-white/60 text-sm relative z-10">
          <Sparkles className="h-4 w-4" />
          <span>Feito para criativos, por criativos</span>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md border-0 shadow-elevated">
          <CardHeader className="text-center pb-2">
            <div className="lg:hidden mb-6">
              <h1 className="text-3xl font-bold text-primary">Gestão Criativa</h1>
              <p className="text-muted-foreground text-sm mt-1">Gestão para profissionais criativos</p>
            </div>
            <CardTitle className="text-2xl font-bold">
              Bem-vindo de volta
            </CardTitle>
            <p className="text-muted-foreground text-sm mt-2">
              Entre com suas credenciais para acessar
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`h-12 ${errors.email ? 'border-destructive' : ''}`}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`h-12 pr-10 ${errors.password ? 'border-destructive' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 transition-all" 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Entrar
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-xs text-muted-foreground">
                Não possui uma conta? Entre em contato com o administrador.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}