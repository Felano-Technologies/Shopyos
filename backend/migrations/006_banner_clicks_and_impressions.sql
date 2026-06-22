-- Add RPC functions for recording banner campaign clicks and impressions atomically
CREATE OR REPLACE FUNCTION record_banner_click(p_campaign_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE banner_campaigns
    SET clicks = COALESCE(clicks, 0) + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_banner_impression(p_campaign_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE banner_campaigns
    SET impressions = COALESCE(impressions, 0) + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;
