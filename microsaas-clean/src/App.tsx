import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Entrar from "./pages/Entrar";
import Transactions from "./pages/Transactions";
import Analytics from "./pages/Analytics";
import Categories from "./pages/Categories";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Plans from "./pages/Plans";
import Admin from "./pages/Admin";
import Dealer from "./pages/Dealer";
import Indique from "./pages/Indique";
import Recompra from "./pages/Recompra";
import Manutencao from "./pages/Manutencao";
import Financiamento from "./pages/Financiamento";
import Rastreador from "./pages/Rastreador";
import CarroConectado from "./pages/CarroConectado";
import Multas from "./pages/Multas";
import Garagem from "./pages/Garagem";
import Suporte from "./pages/Suporte";
import AccessLink from "./pages/AccessLink";
import NotFound from "./pages/NotFound";
import { PendingCouponApplier } from "./components/PendingCouponApplier";
import { InstallPrompt } from "./components/InstallPrompt";
import { MarketingLayout } from "./marketing/MarketingLayout";
import { AboutUs } from "./marketing/pages/AboutUs";
import { Pricing } from "./marketing/pages/Pricing";
import { Blogs } from "./marketing/pages/Blogs";
import { BlogPost } from "./marketing/pages/BlogPost";
import { Contact } from "./marketing/pages/Contact";
import { Integrations } from "./marketing/pages/Integrations";
import { PrivacyPolicy } from "./marketing/pages/PrivacyPolicy";
import { TermsConditions } from "./marketing/pages/TermsConditions";
import { Lp } from "./marketing/pages/Lp";
import { Lp2 } from "./marketing/pages/Lp2";
import { Lp3 } from "./marketing/pages/Lp3";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PendingCouponApplier />
        <InstallPrompt />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/lojista" element={<Dealer />} />
          <Route path="/indique" element={<Indique />} />
          <Route path="/recompra" element={<Recompra />} />
          <Route path="/manutencao" element={<Manutencao />} />
          <Route path="/financiamento" element={<Financiamento />} />
          <Route path="/rastreador" element={<Rastreador />} />
          <Route path="/conectado" element={<CarroConectado />} />
          <Route path="/multas" element={<Multas />} />
          <Route path="/garagem" element={<Garagem />} />
          <Route path="/plans" element={<Plans />} />
          {/* LPs de campanha (tráfego pago) — standalone, sem navbar do site */}
          <Route path="/lp" element={<Lp />} />
          <Route path="/lp2" element={<Lp2 />} />
          <Route path="/lp3" element={<Lp3 />} />
          <Route path="/suporte" element={<Suporte />} />
          {/* Link curto de acesso do WhatsApp (troca o código pelo link mágico) */}
          <Route path="/a/:code" element={<AccessLink />} />

          {/* Site público (marketing) — fundo escuro + navbar + footer */}
          <Route element={<MarketingLayout />}>
            <Route path="/about" element={<AboutUs />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/blogs" element={<Blogs />} />
            <Route path="/blog/:id" element={<BlogPost />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-conditions" element={<TermsConditions />} />
          </Route>

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
