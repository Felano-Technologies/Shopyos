-- 1. Recommendation System Tracking
CREATE TABLE IF NOT EXISTS public.user_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,  -- 'view', 'add_to_cart', 'purchase', 'wishlist'
  weight SMALLINT DEFAULT 1,        -- purchase=5, cart=3, wishlist=2, view=1
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_events_user ON public.user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_product ON public.user_events(product_id);

-- 2. Support System Support Flag
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_support BOOLEAN DEFAULT FALSE;

-- Create the dedicated support user if it doesn't exist
INSERT INTO public.users (id, email, password_hash, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'support@shopyos.com',
    'NOT_A_REAL_PASSWORD_DO_NOT_LOGIN', -- They authenticate via system or admin panel
    true
)
ON CONFLICT (id) DO NOTHING;

-- Assign admin role to support user
INSERT INTO public.user_roles (user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM public.roles WHERE name = 'admin'
ON CONFLICT DO NOTHING;

-- Ensure a profile exists for the support user
INSERT INTO public.user_profiles (user_id, full_name, phone)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Shopyos Support',
    '+0000000000'
)
ON CONFLICT (user_id) DO NOTHING;


-- 3. Quick Snaps
CREATE TABLE IF NOT EXISTS public.snaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  media_url TEXT NOT NULL,
  caption TEXT,
  view_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snaps_active ON public.snaps(expires_at);
