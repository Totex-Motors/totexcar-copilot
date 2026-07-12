import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Car } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import { useVehicle, useUpdateAccount } from '@/hooks/useAccounts';
import { useCreateTransaction, useUpdateTransaction, type Transaction } from '@/hooks/useTransactions';

const transactionSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.string().min(1, 'Valor é obrigatório'),
  type: z.enum(['income', 'expense'], { required_error: 'Tipo é obrigatório' }),
  category_id: z.number({ required_error: 'Categoria é obrigatória' }),
  transaction_date: z.date({ required_error: 'Data é obrigatória' }),
  odometer: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction;
}

export function TransactionForm({ isOpen, onClose, transaction }: TransactionFormProps) {
  const { toast } = useToast();
  const { userId } = useCurrentUser();
  const { data: categories } = useCategories();
  const { vehicle } = useVehicle(userId);

  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const updateAccount = useUpdateAccount();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: '',
      amount: '',
      type: 'expense',
      category_id: undefined,
      transaction_date: new Date(),
      odometer: '',
    },
  });

  useEffect(() => {
    if (transaction) {
      reset({
        description: transaction.description || '',
        amount: transaction.amount ? Math.abs(Number(transaction.amount)).toString() : '',
        type: (transaction.type as 'income' | 'expense') || 'expense',
        category_id: transaction.category_id || undefined,
        transaction_date: transaction.transaction_date ? new Date(transaction.transaction_date) : new Date(),
        odometer: transaction.odometer != null ? transaction.odometer.toString() : '',
      });
    } else {
      reset({
        description: '',
        amount: '',
        type: 'expense',
        category_id: undefined,
        transaction_date: new Date(),
        odometer: vehicle?.hodometro ? vehicle.hodometro.toString() : '',
      });
    }
  }, [transaction, reset, vehicle]);

  const watchType = watch('type');
  const watchDate = watch('transaction_date');

  const onSubmit = async (data: TransactionFormData) => {
    try {
      if (!userId) {
        toast({ title: 'Erro', description: 'Usuário não autenticado.', variant: 'destructive' });
        return;
      }

      if (!vehicle) {
        toast({
          title: 'Cadastre seu veículo',
          description: 'Vá em "Meu Veículo" e cadastre o carro antes de registrar gastos.',
          variant: 'destructive',
        });
        return;
      }

      const transactionData = {
        user_id: userId,
        account_id: vehicle.id,
        description: data.description,
        amount: data.type === 'expense' ? -Math.abs(Number(data.amount)) : Math.abs(Number(data.amount)),
        type: data.type,
        category_id: data.category_id,
        transaction_date: format(data.transaction_date, 'yyyy-MM-dd'),
        odometer: data.odometer ? Number(data.odometer) : null,
        source: 'web',
        raw_input: null,
      };

      if (transaction) {
        await updateTransaction.mutateAsync({ id: transaction.id, updates: transactionData });
        toast({ title: 'Gasto atualizado', description: 'O lançamento foi atualizado com sucesso.' });
      } else {
        await createTransaction.mutateAsync(transactionData);
        toast({ title: 'Gasto registrado', description: 'O lançamento foi criado com sucesso.' });
      }

      // Mantém o hodômetro do carro sempre na MAIOR leitura (nunca retrocede) — mesma regra do WhatsApp
      const odo = transactionData.odometer;
      if (odo && vehicle && (!vehicle.hodometro || odo > Number(vehicle.hodometro))) {
        await updateAccount.mutateAsync({ id: vehicle.id, updates: { hodometro: odo } });
      }

      handleClose();
    } catch (error) {
      toast({ title: 'Erro', description: 'Ocorreu um erro ao salvar o lançamento.', variant: 'destructive' });
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const filteredCategories = categories?.filter((cat) => cat.type === watchType) || [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
        </DialogHeader>

        {vehicle && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Car className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">
              {vehicle.name}
              {vehicle.placa ? ` · ${vehicle.placa}` : ''}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              {...register('description')}
              placeholder="Ex: Abastecimento, Troca de óleo, Pneu dianteiro..."
              className={errors.description ? 'border-destructive' : ''}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                {...register('amount')}
                type="number"
                step="0.01"
                placeholder="0,00"
                className={errors.amount ? 'border-destructive' : ''}
              />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={watchType} onValueChange={(value) => setValue('type', value as 'income' | 'expense')}>
                <SelectTrigger className={errors.type ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="w-3 h-3 p-0" />
                      Gasto
                    </div>
                  </SelectItem>
                  <SelectItem value="income">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="w-3 h-3 p-0 bg-success" />
                      Receita / Reembolso
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category_id">Categoria</Label>
            <Select value={watch('category_id')?.toString()} onValueChange={(value) => setValue('category_id', Number(value))}>
              <SelectTrigger className={errors.category_id ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category_id && <p className="text-sm text-destructive">{errors.category_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !watchDate && 'text-muted-foreground',
                      errors.transaction_date && 'border-destructive'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watchDate ? format(watchDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={watchDate}
                    onSelect={(date) => date && setValue('transaction_date', date)}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              {errors.transaction_date && <p className="text-sm text-destructive">{errors.transaction_date.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="odometer">Hodômetro (km)</Label>
              <Input id="odometer" {...register('odometer')} type="number" step="1" placeholder="Ex: 45000" />
              <p className="text-xs text-muted-foreground">Km no momento do gasto (opcional)</p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={createTransaction.isPending || updateTransaction.isPending}>
              {createTransaction.isPending || updateTransaction.isPending ? 'Salvando...' : transaction ? 'Atualizar' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
