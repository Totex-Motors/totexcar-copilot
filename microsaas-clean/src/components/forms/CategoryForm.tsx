import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCreateCategory, useUpdateCategory, type Category } from '@/hooks/useCategories';
import {
  Car, DollarSign, Gift, Wrench,
  Fuel, Cog, CircleDot, ShieldCheck, Landmark, ScrollText,
  AlertTriangle, Sparkles, Droplets, SquareParking, Milestone,
  Banknote, Hammer, Undo2
} from 'lucide-react';

const categorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['income', 'expense'], { required_error: 'Tipo é obrigatório' }),
  color: z.string().min(1, 'Cor é obrigatória'),
  icon: z.string().min(1, 'Ícone é obrigatório'),
});

type CategoryFormData = z.infer<typeof categorySchema>;

const ICON_OPTIONS = [
  { value: 'Fuel', label: 'Combustível', icon: Fuel },
  { value: 'Wrench', label: 'Manutenção', icon: Wrench },
  { value: 'Cog', label: 'Peças', icon: Cog },
  { value: 'CircleDot', label: 'Pneus', icon: CircleDot },
  { value: 'ShieldCheck', label: 'Seguro', icon: ShieldCheck },
  { value: 'Landmark', label: 'IPVA', icon: Landmark },
  { value: 'ScrollText', label: 'Licenciamento', icon: ScrollText },
  { value: 'AlertTriangle', label: 'Multas', icon: AlertTriangle },
  { value: 'Sparkles', label: 'Acessórios', icon: Sparkles },
  { value: 'Droplets', label: 'Lavagem', icon: Droplets },
  { value: 'SquareParking', label: 'Estacionamento', icon: SquareParking },
  { value: 'Milestone', label: 'Pedágio', icon: Milestone },
  { value: 'Banknote', label: 'Financiamento', icon: Banknote },
  { value: 'Hammer', label: 'Serviços', icon: Hammer },
  { value: 'Car', label: 'Veículo', icon: Car },
  { value: 'Undo2', label: 'Reembolso', icon: Undo2 },
  { value: 'DollarSign', label: 'Receita', icon: DollarSign },
  { value: 'Gift', label: 'Outros', icon: Gift },
];

const COLOR_OPTIONS = [
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#f97316', label: 'Laranja' },
  { value: '#eab308', label: 'Amarelo' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#06b6d4', label: 'Ciano' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#ec4899', label: 'Rosa' },
];

interface CategoryFormProps {
  isOpen: boolean;
  onClose: () => void;
  category?: Category;
}

export function CategoryForm({ isOpen, onClose, category }: CategoryFormProps) {
  const [selectedIcon, setSelectedIcon] = useState(category?.icon || '');
  const [selectedColor, setSelectedColor] = useState(category?.color || '');
  const { toast } = useToast();
  
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name || '',
      type: (category?.type as 'income' | 'expense') || 'expense',
      color: category?.color || '',
      icon: category?.icon || '',
    },
  });

  const watchType = watch('type');

  const onSubmit = async (data: CategoryFormData) => {
    try {
      if (category) {
        await updateCategory.mutateAsync({
          id: category.id,
          updates: data,
        });
        toast({
          title: 'Categoria atualizada',
          description: 'A categoria foi atualizada com sucesso.',
        });
      } else {
        await createCategory.mutateAsync({
          name: data.name,
          type: data.type,
          color: data.color,
          icon: data.icon,
        });
        toast({
          title: 'Categoria criada',
          description: 'A categoria foi criada com sucesso.',
        });
      }
      handleClose();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao salvar a categoria.',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    reset();
    setSelectedIcon('');
    setSelectedColor('');
    onClose();
  };

  const handleIconSelect = (iconValue: string) => {
    setSelectedIcon(iconValue);
    setValue('icon', iconValue);
  };

  const handleColorSelect = (colorValue: string) => {
    setSelectedColor(colorValue);
    setValue('color', colorValue);
  };

  const getIconComponent = (iconName: string) => {
    const iconOption = ICON_OPTIONS.find(opt => opt.value === iconName);
    if (!iconOption) return null;
    const IconComponent = iconOption.icon;
    return <IconComponent className="w-5 h-5" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Editar Categoria' : 'Nova Categoria'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Nome da categoria"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select onValueChange={(value) => setValue('type', value as 'income' | 'expense')}>
              <SelectTrigger className={errors.type ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Ícone</Label>
            <div className="grid grid-cols-4 gap-2">
              {ICON_OPTIONS.map((option) => {
                const IconComponent = option.icon;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={selectedIcon === option.value ? 'default' : 'outline'}
                    className="h-12 p-2"
                    onClick={() => handleIconSelect(option.value)}
                  >
                    <IconComponent className="w-5 h-5" />
                  </Button>
                );
              })}
            </div>
            {errors.icon && (
              <p className="text-sm text-destructive">{errors.icon.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Cor</Label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_OPTIONS.map((color) => (
                <Button
                  key={color.value}
                  type="button"
                  variant={selectedColor === color.value ? 'default' : 'outline'}
                  className="h-12 p-2"
                  onClick={() => handleColorSelect(color.value)}
                >
                  <div
                    className="w-6 h-6 rounded-full border-2 border-background"
                    style={{ backgroundColor: color.value }}
                  />
                </Button>
              ))}
            </div>
            {errors.color && (
              <p className="text-sm text-destructive">{errors.color.message}</p>
            )}
          </div>

          {selectedIcon && selectedColor && (
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div
                className="p-2 rounded-lg text-white"
                style={{ backgroundColor: selectedColor }}
              >
                {getIconComponent(selectedIcon)}
              </div>
              <div>
                <p className="font-medium">Preview</p>
                <Badge variant={watchType === 'income' ? 'default' : 'secondary'}>
                  {watchType === 'income' ? 'Receita' : 'Despesa'}
                </Badge>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={createCategory.isPending || updateCategory.isPending}
            >
              {createCategory.isPending || updateCategory.isPending
                ? 'Salvando...'
                : category
                ? 'Atualizar'
                : 'Criar'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}