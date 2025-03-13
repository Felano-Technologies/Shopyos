const express = require('express');
const { getRecipes, getRecipesById } = require('../controllers/recipeController');
const router = express.Router();

router.get('/', getRecipes);
router.get('/id', getRecipesById);

module.exports = router;