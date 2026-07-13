import { useState } from 'react';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { 
  Plus, 
  Search, 
  Filter, 
  Download,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft
} from "lucide-react";
import { useTransactions, useDeleteTransaction, type Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useCurrentUser } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTrialControl } from "@/hooks/useTrialControl";
import { TrialBlockModal } from "@/components/trial/TrialBlockModal";

const Transactions = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | undefined>();
  const [showTrialModal, setShowTrialModal] = useState(false);
  
  const { toast } = useToast();
  const { blockAccess } = useTrialControl();
  const { userId } = useCurrentUser();
  const { data: transactions, isLoading } = useTransactions(userId);
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts(userId);
  const deleteTransaction = useDeleteTransaction();
  
  console.log('🔍 Transactions - userId:', userId);
  console.log('🔍 Transactions - transactions:', transactions);
  console.log('🔍 Transactions - categories:', categories);
  console.log('🔍 Transactions - accounts:', accounts);

  const getCategoryName = (categoryId: number) => {
    const category = categories?.find(cat => cat.id === categoryId);
    return category?.name || 'Sem categoria';
  };

  const getCategoryColor = (categoryId: number) => {
    const category = categories?.find(cat => cat.id === categoryId);
    return category?.color || '#6B7280';
  };

  const getAccountName = (accountId: string) => {
    const account = accounts?.find(acc => acc.id === accountId);
    return account?.name || 'Conta desconhecida';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const filteredTransactions = transactions?.filter(transaction =>
    transaction.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleEditTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsFormOpen(true);
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    
    try {
      await deleteTransaction.mutateAsync(transactionToDelete.id);
      toast({
        title: 'Transação excluída',
        description: 'A transação foi excluída com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a transação.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setTransactionToDelete(undefined);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedTransaction(undefined);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Gastos do Carro</h1>
          <p className="text-muted-foreground">
            Combustível, peças, revisões, seguro, IPVA, multas e mais
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm" className="bg-gradient-primary hover:opacity-90" onClick={() => {
            if (blockAccess('registrar gastos')) {
              setShowTrialModal(true);
              return;
            }
            setIsFormOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Gasto
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-premium-md">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar gastos..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Todos os Gastos ({filteredTransactions?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {filteredTransactions && filteredTransactions.length > 0 ? (
              filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 p-6 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={cn(
                      "p-3 rounded-xl flex items-center justify-center shrink-0",
                      transaction.type === "income" ? "bg-success/10" : "bg-destructive/10"
                    )}>
                      {transaction.type === "income" ? (
                        <ArrowUpRight className="h-5 w-5 text-success" />
                      ) : (
                        <ArrowDownLeft className="h-5 w-5 text-destructive" />
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {transaction.description || 'Sem descrição'}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Badge
                          variant="secondary"
                          className="text-xs text-white"
                          style={{ backgroundColor: getCategoryColor(transaction.category_id!) }}
                        >
                          {getCategoryName(transaction.category_id!)}
                        </Badge>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {getAccountName(transaction.account_id!)}
                        </span>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(transaction.transaction_date!)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className="text-right">
                      <p className={cn(
                        "font-bold text-lg whitespace-nowrap",
                        transaction.type === "income" ? "text-success" : "text-foreground"
                      )}>
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleEditTransaction(transaction)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteTransaction(transaction)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <ArrowUpRight className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Nenhum gasto encontrado</h3>
                <p className="text-muted-foreground mb-4">Comece registrando o primeiro gasto do seu carro</p>
                <Button className="bg-gradient-primary hover:opacity-90" onClick={() => setIsFormOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Gasto
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <TransactionForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        transaction={selectedTransaction}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir gasto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o gasto "{transactionToDelete?.description}"?
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

      <TrialBlockModal 
        open={showTrialModal} 
        onOpenChange={setShowTrialModal} 
        feature="registrar gastos"
      />
    </DashboardLayout>
  );
};

export default Transactions;