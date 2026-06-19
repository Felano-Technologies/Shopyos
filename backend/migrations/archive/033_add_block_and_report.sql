-- Create user_blocks table to handle blocking functionality
CREATE TABLE IF NOT EXISTS public.user_blocks (
    blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id)
);

-- Index for quick lookups of who a user has blocked
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON public.user_blocks(blocker_id);

-- Create user_reports table
CREATE TABLE IF NOT EXISTS public.user_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    reported_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    reported_store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('user', 'store')),
    reason VARCHAR(255) NOT NULL,
    details TEXT,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resolution_notes TEXT,

    -- Ensure either user or store is reported, not both or neither
    CONSTRAINT check_reported_entity CHECK (
        (entity_type = 'user' AND reported_user_id IS NOT NULL AND reported_store_id IS NULL) OR
        (entity_type = 'store' AND reported_store_id IS NOT NULL AND reported_user_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_user_reports_status ON public.user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter_id ON public.user_reports(reporter_id);
