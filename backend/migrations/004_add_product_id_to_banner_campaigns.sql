-- Add product_id to banner_campaigns
ALTER TABLE banner_campaigns 
ADD COLUMN product_id UUID REFERENCES products(id) ON DELETE CASCADE;

-- Add index on product_id
CREATE INDEX IF NOT EXISTS idx_banner_campaigns_product_id ON banner_campaigns(product_id);
