const express = require("express");
const router = express.Router();
const productController = require("../contorllers/productController");

// Product management routes
router.post("products/add", productController.addProduct);
router.get("/products", productController.getProducts);
router.get("/products/:id", productController.getProductById);
router.put("/products/:id", productController.updateProduct);
router.delete("/products/:id", productController.deleteProduct);
router.get("/products/search", productController.searchProducts);

// Price tracking routes
router.post("/products/:id/track-price", productController.trackPrice);
router.get("/products/:id/price-history", productController.getPriceHistory);

// Get products by category
router.get(
  "products/category/:categoryId",
  productController.getProductsByCategory
);

// Reviews and ratings

// Get products by vendor


module.exports = router;
