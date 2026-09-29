import { useState } from 'react';
import { Navigate } from "react-router-dom";
import { MgShell } from "@/components/mg/MgShell";
import { CategoryForm } from "@/components/forms/CategoryForm";
import { useCategories, useDeleteCategory, useCategoryStats, type Category } from "@/hooks/useCategories";
import { useCurrentUser } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Edit2, Trash2, ShoppingCart, Car, Home, Coffee, Heart, Gamepad2, DollarSign,
  Briefcase, Plane, GraduationCap, Gift, Phone, Zap, Wrench, Fuel, Settings, Cog, CircleDot,
  ShieldCheck, Landmark, ScrollText, AlertTriangle, Sparkles, Droplets, SquareParking, Milestone,
  Banknote, FileCheck, Hammer, MoreHorizontal, Undo2, BadgeCheck,
} from "lucide-react";

const ICON_MAP = {
  ShoppingCart, Car, Home, Coffee, Heart, Gamepad2, DollarSign, Briefcase, Plane, GraduationCap,
  Gift, Phone, Zap, Wrench, Fuel, Settings, Cog, CircleDot, ShieldCheck, Landmark, ScrollText,
  AlertTriangle, Sparkles, Droplets, SquareParking, Milestone, Banknote, FileCheck, Hammer, MoreHorizontal, Undo2, BadgeCheck,
};

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// TELA CATEGORIAS — organiza os gastos do carro por categoria. Padrão Minha Garagem.
const Categories = () => {
  const [q, setQ] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selected, setSelected] = useState<Category | undefined>();
  const { toast } = useToast();
  const { userId, userData, loading } = useCurrentUser();
  const { data: categories, isLoading } = useCategories();
  const { data: categoryStats } = useCategoryStats(userId);
  const del = useDeleteCategory();

  const icon = (name?: string) => {
    const Ic = ICON_MAP[(name || 'ShoppingCart') as keyof typeof ICON_MAP] || ShoppingCart;
    return <Ic size={18} />;
  };
  const statOf = (id: number) => categoryStats?.find((s) => s.id === id) || { totalAmount: 0, transactionCount: 0 };

  const filtered = (categories || []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const expense = filtered.filter((c) => c.type === "expense");
  const income = filtered.filter((c) => c.type === "income");

  const remover = (c: Category) => {
    if (!window.confirm(`Excluir a categoria "${c.name}"?`)) return;
    del.mutateAsync(c.id)
      .then(() => toast({ title: "Categoria excluída" }))
      .catch(() => toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" }));
  };

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const Grupo = ({ title, list, isIncome }: { title: string; list: Category[]; isIncome?: boolean }) => (
    <div>
      <div className="eyebrow" style={{ margin: "4px 2px 10px" }}>{title} ({list.length})</div>
      {list.length ? (
        <section className="card" style={{ padding: 4 }}>
          {list.map((c) => {
            const s: any = statOf(c.id);
            return (
              <div key={c.id} className="list-row">
                <span style={{ width: 40, height: 40, borderRadius: 11, background: c.color || "var(--brand)", color: "#fff", display: "grid", placeItems: "center", flex: "none" }}>{icon(c.icon)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">{c.name}</div>
                  <div className="s">{isIncome ? "Recebido" : "Gasto"} {brl(s.totalAmount)} · {s.transactionCount} lanç.</div>
                </div>
                {!c.is_system && (
                  <div style={{ display: "flex", gap: 6, flex: "none" }}>
                    <button className="sbtn" style={{ padding: "8px 9px" }} onClick={() => { setSelected(c); setIsFormOpen(true); }} aria-label="Editar"><Edit2 size={14} /></button>
                    <button className="sbtn" style={{ padding: "8px 9px", color: "var(--alert)" }} onClick={() => remover(c)} aria-label="Excluir"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ) : (
        <div className="card pad" style={{ textAlign: "center", fontSize: 13, color: "var(--muted)" }}>Nenhuma categoria aqui.</div>
      )}
    </div>
  );

  return (
    <MgShell title="Categorias" back="/">
      <div className="stack">
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 2px" }}>Organize os gastos do carro por categoria.</p>

        <div style={{ position: "relative" }}>
          <Search size={17} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }} />
          <input className="field" style={{ paddingLeft: 40 }} placeholder="Buscar categorias..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="card pad" style={{ textAlign: "center", color: "var(--muted)" }}>Carregando categorias...</div>
        ) : (
          <>
            <Grupo title="Despesas" list={expense} />
            <Grupo title="Receitas" list={income} isIncome />
          </>
        )}

        <button className="btn-primary" onClick={() => { setSelected(undefined); setIsFormOpen(true); }}><Plus size={16} /> Nova categoria</button>
      </div>

      <CategoryForm isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setSelected(undefined); }} category={selected} />
    </MgShell>
  );
};

export default Categories;
