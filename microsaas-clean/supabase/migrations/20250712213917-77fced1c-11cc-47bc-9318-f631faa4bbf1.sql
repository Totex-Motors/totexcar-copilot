-- Confirmar o email do usuário existente para permitir login
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE id = '102237b8-3cd3-4655-b011-1d5e2d58dc92';