-- Recriar a função para criar usuário na tabela public.users automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    phone,
    name,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar o trigger para executar a função quando um novo usuário se cadastra
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Inserir manualmente o usuário que acabou de se cadastrar
INSERT INTO public.users (
  id,
  phone, 
  name,
  created_at,
  updated_at
) VALUES (
  '2e70423b-0409-4062-9536-4f7627c01b8d',
  '+553192320736',
  'Frank Costa',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;