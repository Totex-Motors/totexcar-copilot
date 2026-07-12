-- Adicionar categorias padrão do sistema
INSERT INTO categories (name, type, color, icon, is_system) VALUES
-- Categorias de Despesa
('Alimentação', 'expense', '#f97316', 'ShoppingCart', true),
('Transporte', 'expense', '#3b82f6', 'Car', true),
('Moradia', 'expense', '#22c55e', 'Home', true),
('Saúde', 'expense', '#ef4444', 'Heart', true),
('Educação', 'expense', '#8b5cf6', 'GraduationCap', true),
('Lazer', 'expense', '#ec4899', 'Coffee', true),
('Compras', 'expense', '#eab308', 'ShoppingCart', true),
('Telefone', 'expense', '#06b6d4', 'Phone', true),
('Energia', 'expense', '#f59e0b', 'Zap', true),
('Outros', 'expense', '#6b7280', 'Wrench', true),

-- Categorias de Receita
('Salário', 'income', '#10b981', 'DollarSign', true),
('Freelance', 'income', '#059669', 'Briefcase', true),
('Investimentos', 'income', '#0d9488', 'DollarSign', true),
('Vendas', 'income', '#0891b2', 'DollarSign', true),
('Outras Receitas', 'income', '#0284c7', 'Gift', true);