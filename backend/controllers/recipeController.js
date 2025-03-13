const Recipe = require("../models/Recipe");

// Get all recipes
exports.getRecipes = async (req, res) => {
  try {
    const recipes = await Recipe.find(); // Fetch all recipes
    res.json(recipes); // Return the recipes as JSON
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get a specific recipe by ID
exports.getRecipesById = async (req, res) => {
  try {
    const recipeId = req.params.id; // Extract recipe ID from request parameters
    const recipe = await Recipe.findById(recipeId); // Fetch the recipe with the given ID

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    res.json(recipe); // Return the recipe as JSON
  } catch (error) {
    console.error('Error fetching recipe by ID:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    res.status(500).json({ error: 'Server error' });
  }
};
