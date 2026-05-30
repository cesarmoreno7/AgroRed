-- 020: Agrega contact_phone a users para unificar datos de contacto

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(30) NULL;

COMMENT ON COLUMN public.users.contact_phone IS
  'Teléfono de contacto del usuario. Permite asociar contacto institucional sin depender de producers.';
