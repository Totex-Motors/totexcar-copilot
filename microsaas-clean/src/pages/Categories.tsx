import { useState } from 'react';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CategoryForm } from "@/components/forms/CategoryForm";
import { useCategories, useDeleteCategory, useCategoryStats, type Category } from "@/hooks/useCategories";
import { useCurrentUser } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ShoppingCart,
  Car,
  Home,
  Coffee,
  Heart,
  Gamepad2,
  DollarSign,
  Briefcase,
  Plane,
  GraduationCap,
  Gift,
  Phone,
  Zap,
  Wrench,
  Fuel,
  Settings,
  Cog,
  CircleDot,
  ShieldCheck,
  Landmark,
  ScrollText,
  AlertTriangle,
  Sparkles,
  Droplets,
  SquareParking,
  Milestone,
  Banknote,
  FileCheck,
  Hammer,
  MoreHorizontal,
  Undo2,
  BadgeCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP = {
  ShoppingCart,
  Car,
  Home,
  Coffee,
  Heart,
  Gamepad2,
  DollarSign,
  Briefcase,
  Plane,
  GraduationCap,
  Gift,
  Phone,
  Zap,
  Wrench,
  Fuel,
  Settings,
  Cog,
  CircleDot,
  ShieldCheck,
  Landmark,
  ScrollText,
  AlertTriangle,
  Sparkles,
  Droplets,
  SquareParking,
  Milestone,
  Banknote,
  FileCheck,
  Hammer,
  MoreHorizontal,
  Undo2,
  BadgeCheck,
};

const Categories = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | undefined>();
  
  const { toast } = useToast();
  const { userId } = useCurrentUser();
  const { data: categories, isLoading } = useCategories();
  const { data: categoryStats } = useCategoryStats(userId);
  const deleteCategory = useDeleteCategory();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const getIconComponent = (iconName: string) => {
    const IconComponent = ICON_MAP[iconName as keyof typeof ICON_MAP];
    return IconComponent ? <IconComponent className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />;
  };

  const getCategoryStats = (categoryId: number) => {
    return categoryStats?.find(stat => stat.id === categoryId) || {
      totalAmount: 0,
      transactionCount: 0,
    };
  };

  const filteredCategories = categories?.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const expenseCategories = filteredCategories.filter(cat => cat.type === "expense");
  const incomeCategories = filteredCategories.filter(cat => cat.type === "income");

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setIsFormOpen(true);
  };

  const handleDeleteCategory = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    
    try {
      await deleteCategory.mutateAsync(categoryToDelete.id);
      toast({
        title: 'Categoria excluída',
        description: 'A categoria foi excluída com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a categoria.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setCategoryToDelete(undefined);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedCategory(undefined);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando categorias...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Categorias</h1>
          <p className="text-muted-foreground">
            Organize os gastos do carro por categorias personalizadas
          </p>
        </div>
        <Button size="sm" className="bg-gradient-primary hover:opacity-90" onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-premium-md">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar categorias..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories Grid */}
      <div className="space-y-8">
        {/* Expense Categories */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Categorias de Despesas</h2>
              <p className="text-sm text-muted-foreground">{expenseCategories.length} categorias</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {expenseCategories.map((category) => {
              const stats = getCategoryStats(category.id);
              return (
                <Card key={category.id} className="border-0 shadow-premium-md hover:shadow-premium-lg transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-3 rounded-xl text-white"
                          style={{ backgroundColor: category.color }}
                        >
                          {getIconComponent(category.icon || 'ShoppingCart')}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{category.name}</h3>
                          <Badge variant="secondary" className="mt-1">
                            Despesa
                          </Badge>
                        </div>
                      </div>
                      
                      {!category.is_system && (
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleEditCategory(category)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteCategory(category)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total gasto:</span>
                        <span className="font-semibold text-foreground">{formatCurrency(stats.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Transações:</span>
                        <span className="font-semibold text-foreground">{stats.transactionCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Média por transação:</span>
                        <span className="font-semibold text-foreground">
                          {stats.transactionCount > 0 ? formatCurrency(stats.totalAmount / stats.transactionCount) : formatCurrency(0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Income Categories */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Categorias de Receitas</h2>
              <p className="text-sm text-muted-foreground">{incomeCategories.length} categorias</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {incomeCategories.map((category) => {
              const stats = getCategoryStats(category.id);
              return (
                <Card key={category.id} className="border-0 shadow-premium-md hover:shadow-premium-lg transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-3 rounded-xl text-white"
                          style={{ backgroundColor: category.color }}
                        >
                          {getIconComponent(category.icon || 'DollarSign')}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{category.name}</h3>
                          <Badge variant="secondary" className="mt-1 bg-success/10 text-success">
                            Receita
                          </Badge>
                        </div>
                      </div>
                      
                      {!category.is_system && (
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleEditCategory(category)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteCategory(category)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total recebido:</span>
                        <span className="font-semibold text-success">{formatCurrency(stats.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Transações:</span>
                        <span className="font-semibold text-foreground">{stats.transactionCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Média por transação:</span>
                        <span className="font-semibold text-foreground">
                          {stats.transactionCount > 0 ? formatCurrency(stats.totalAmount / stats.transactionCount) : formatCurrency(0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <CategoryForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        category={selectedCategory}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria "{categoryToDelete?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Categories;