-- Space customization: per-element styling + new block/widget types.
-- Safe to run more than once.

-- 1. Per-element style (radius, shadow, border, font, texture, opacity, …)
--    stored as flexible JSON so the schema doesn't change as we add controls.
ALTER TABLE public.space_items
  ADD COLUMN IF NOT EXISTS style JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Allow new block types. `type` is a TEXT column; if a CHECK constraint
--    currently restricts its values, drop it and re-add an expanded one.
DO $$
DECLARE
  c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.space_items'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.space_items DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.space_items
  ADD CONSTRAINT space_items_type_check
  CHECK (type IN (
    'note', 'about', 'image', 'drawing',   -- existing
    'link', 'header', 'divider', 'music'   -- new
  ));
