const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  unit: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
});

const recipeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  cookingMinutes: {
    type: String,
    required: true,
  },
  dairyFree: {
    type: String,
    required: true,
  },
  dishType: {
    type: [String], // Array of strings
    required: true,
  },
  ingredients: {
    type: [ingredientSchema], // Array of ingredient objects
    required: true,
  },
  CookingProcedure: {
    type: String,
    required: true,
  },
});

const Recipe = mongoose.model('Recipe', recipeSchema);

module.exports = Recipe;
