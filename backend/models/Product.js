const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    image: { type: String, required: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    stock: { type: Number, default: 0 }, // Number of items in stock
    rating: { type: Number, default: 0 }, // Average rating,
    reviews: [
      {
        // Number of reviews
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        }, // Reviewer
        comment: { type: String, trim: true },
        stars: { type: Number, required: true, min: 1, max: 5 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // Seller reference
    priceHistory: [
      {
        date: { type: Date, default: Date.now },
        price: { type: Number, required: true, min: 0 }
      }
    ],
  },
  { timestamps: true }
);

ProductSchema.pre("save", function (next) {
  // Ensure that the price history is always sorted by date
    this.priceHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Ensure stock is never negative
    if (this.stock < 0) this.stock = 0;

  if (this.stock < 0) this.stock = 0;
  next();
})

module.exports = mongoose.model("Product", ProductSchema);
