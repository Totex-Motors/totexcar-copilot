-- Função para criar usuário na tabela public.users automaticamente
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
    NEW.raw_user_meta_data->>'name',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para executar a função quando um novo usuário se cadastra
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Criar manualmente o usuário que acabou de se cadastrar
INSERT INTO public.users (
  id,
  phone, 
  name,
  created_at,
  updated_at
) VALUES (
  '102237b8-3cd3-4655-b011-1d5e2d58dc92',
  '+553192320736',
  'Frank Costa',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;