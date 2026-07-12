import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TrialBlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
}

export function TrialBlockModal({ open, onOpenChange, feature = "esta funcionalidade" }: TrialBlockModalProps) {
  const navigate = useNavigate();
  const loading = false;

  const handleUpgrade = (_planType: 'monthly' | 'annual') => {
    onOpenChange(false);
    navigate('/plans');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">
            Trial Expirado
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            Seu período de teste de 7 dias expirou. Para continuar usando {feature}, 
            escolha um dos nossos planos premium.
          </p>

          <div className="grid grid-cols-1 gap-3">
            {/* Plano Mensal */}
            <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold">Plano Mensal</h3>
                  <p className="text-sm text-muted-foreground">Totex Care</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">R$ 109,90</div>
                  <div className="text-sm text-muted-foreground">/mês</div>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => handleUpgrade('monthly')}
                disabled={loading}
              >
                Ver planos
              </Button>
            </div>

            {/* Plano Anual */}
            <div className="border-2 border-primary rounded-lg p-4 relative bg-primary/5">
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                  Bônus Totex −90%
                </span>
              </div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold">Com cupom de loja</h3>
                  <p className="text-sm text-muted-foreground">Membro do ecossistema</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">R$ 10,99</div>
                  <div className="text-sm text-muted-foreground">/mês</div>
                  <div className="text-xs text-primary">ou R$ 109,90/ano</div>
                </div>
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => handleUpgrade('annual')}
                disabled={loading}
              >
                Ver planos
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">O que você terá:</h4>
            <div className="text-sm text-left space-y-1">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Gastos ilimitados</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Alertas de vencimento (IPVA, licenciamento, seguro, CNH)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Relatórios avançados</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Suporte prioritário</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}