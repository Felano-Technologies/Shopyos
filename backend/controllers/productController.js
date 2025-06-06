// Products
const Product = require("../models/Product");

// Add a new product
exports.addProduct = async (req, res) => {
  try {
    const { name, description, price, image, category, stock, vendor } =
      req.body;

    if (!name || !price || !image || !category || !vendor) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const newProduct = new Product({
      name,
      description,
      price,
      image,
      category,
      stock,
      vendor,
    });

    const product = await newProduct.save();

    res.status(201).json({ message: "Product created successfully", product });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get all products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("category")
      .populate("vendor");

    res.status(200).json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server erorr" });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category")
      .populate("vendor");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json(product);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { name, description, price, image, category, stock, vendor } =
      req.body;

    if (!name || !price || !image || !category || !vendor) {
      return res.status(400).json({ message: "Required fieleds missing" });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { name, description, price, image, category, stock, vendor },
      { new: true }
    )
      .populate("category")
      .populate("vendor");

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res
      .status(200)
      .json({ message: "Product updated successfully", updatedProduct });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Search products
exports.searchProducts = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const products = await Product.find(
      {
        $or: [
          { name: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ],
      }
        .populate("category")
        .populate("vendor")
    );

    if (products.length === 0) {
      return res.status(404).json({ message: "No matching products found" });
    }

    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
  try {
    const category = req.params.categoryId;

    // Find products by category
    const products = await Product.find({ category: categoryId })
      .populate("category")
      .populate("vendor");

    if (!products || products.length === 0) {
      return res
        .status(404)
        .json({ message: "No products found for this category" });
    }

    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Track price
exports.trackPrice = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const { price } = req.body;

    if (!price) {
      return res.status(400).json({ message: "Price is required" });
    }

    product.priceHistory.push({ price });
    await product.save();

    res.status(200).json({ message: "Price tracked enabled", product });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get price history
exports.getPriceHistory = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json(product.priceHistory);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Add review
