import { Button } from "@/components/ui/button";
import { Crown, Clock, AlertTriangle } from "lucide-react";
import { useTrialControl } from "@/hooks/useTrialControl";
import { Link } from "react-router-dom";

export function TrialBanner() {
  const { trialInfo, getTrialMessage } = useTrialControl();
  
  const message = getTrialMessage();
  
  if (!message || trialInfo.isPremium) return null;

  const getVariantClasses = () => {
    switch (message.type) {
      case 'expired':
        return 'bg-destructive/10 border-destructive/30 text-destructive';
      case 'urgent':
        return 'bg-warning/10 border-warning/30 text-warning-foreground';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200';
      default:
        return 'bg-primary/5 border-primary/20 text-primary';
    }
  };

  const getIcon = () => {
    switch (message.type) {
      case 'expired':
        return <AlertTriangle className="w-4 h-4 flex-shrink-0" />;
      case 'urgent':
      case 'warning':
        return <Clock className="w-4 h-4 flex-shrink-0" />;
      default:
        return <Crown className="w-4 h-4 flex-shrink-0" />;
    }
  };

  return (
    <div className={`border rounded-lg p-3 mb-4 ${getVariantClasses()}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="text-sm font-medium">
            {message.message}
          </span>
        </div>
        
        <Button 
          size="sm" 
          variant={message.type === 'expired' ? 'destructive' : 'default'}
          className="flex-shrink-0"
          asChild
        >
          <Link to="/plans">
            {message.type === 'expired' ? 'Reativar Agora' : 'Ver Planos'}
          </Link>
        </Button>
      </div>
    </div>
  );
}