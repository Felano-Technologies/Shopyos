const mongoose = require("mongoose");
const slugify = require("slugify");

const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null }, // For subcategories
    isFeatured: { type: Boolean, default: false }, // Show featured categories on homepage
    slug: { type: String, unique: true} // For SEO-friendly URLs
    
}, { timestamps: true });

CategorySchema.pre("save", function (next) {
    if (!this.slug) {
        this.slug = slugify(this.name, { lower: true, strict: true})
    }
    next();
})

module.exports = mongoose.model("Category", CategorySchema)