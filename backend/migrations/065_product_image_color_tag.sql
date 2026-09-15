-- Lets a seller tag one of a product's uploaded photos as representing a
-- specific color/variant value (e.g. "Red"), so the buyer's product detail
-- gallery can jump straight to that photo when they pick that color —
-- mirroring the color-swatch-swaps-photo pattern common on marketplace apps.
-- Nullable: untagged photos behave exactly as before.
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS color_tag TEXT;
