import { useAuth } from "@/hooks/useAuth";
import Index from "./Index";
import { MarketingLayout } from "@/marketing/MarketingLayout";
import { Home as MarketingHome } from "@/marketing/pages/Home";

// Home pública: visitante deslogado vê a landing (site de marketing); logado vê o dashboard.
export default function Home() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (user) return <Index />;
  return (
    <MarketingLayout>
      <MarketingHome />
    </MarketingLayout>
  );
}
