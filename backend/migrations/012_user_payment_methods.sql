-- =====================================================
-- Shopyos E-commerce Platform
-- Migration 012: User Payment Methods
-- =====================================================

CREATE TABLE IF NOT EXISTS user_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- card, momo
    provider VARCHAR(50) NOT NULL, -- visa, mastercard, mtn, vodafone, airteltigo
    title VARCHAR(255) NOT NULL,
    identifier VARCHAR(255) NOT NULL, -- masked or last 4 digits
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_payment_identifier UNIQUE (user_id, identifier)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user_id ON user_payment_methods(user_id);

-- Trigger to ensure only one default payment method per user
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default THEN
        UPDATE user_payment_methods
        SET is_default = FALSE
        WHERE user_id = NEW.user_id AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_single_default_payment_method
BEFORE INSERT OR UPDATE OF is_default ON user_payment_methods
FOR EACH ROW
WHEN (NEW.is_default = TRUE)
EXECUTE FUNCTION ensure_single_default_payment_method();
