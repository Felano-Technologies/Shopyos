-- Create banner_campaigns table
CREATE TABLE IF NOT EXISTS banner_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  placement VARCHAR(50) NOT NULL,
  duration_days INTEGER NOT NULL,
  paid_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'Pending',
  banner_url TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  rejection_reason TEXT,
  paystack_reference VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
