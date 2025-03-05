const Recipe = require('./models/Recipe');
const connectDB = require('./config/db');
const dotenv = require('dotenv');

dotenv.config();

 connectDB();

 const recipes = [
  {
    id: '1',
    title: 'Jollof',
    image: 'http://localhost:3000/1.jpg',
    cookingMinutes: '45-60',
    dairyFree: 'false',
    dishType: ['lunch', 'main course', 'supper', 'dinner'], // Array of strings
    ingredients: [
      {
        id: '1',
        originalName: 'Long-grain rice',
        unit: 'cups',
        amount: 2-3,
      },
      {
        id: '2',
        originalName: 'Onions',
        unit: 'pieces',
        amount: 2,
      },
      {
        id: '3',
        originalName: 'Oil',
        unit: 'tbsp',
        amount: 4-8,
      },
      {
        id: '4',
        originalName: 'Garlic',
        unit: 'cloves',
        amount: 2,
      },
      {
        id: '5',
        originalName: 'Fresh ginger',
        unit: 'inch',
        amount: 1,
      },
      {
        id: '6',
        originalName: 'Tomato puree',
        unit: 'tbsp',
        amount: 2-3,
      },
      {
        id: '7',
        originalName: 'Fresh tomatoes',
        unit: 'pieces',
        amount: 4-6,
      },
      {
        id: '8',
        originalName: 'Seasoning',
        unit: 'cube',
        amount: 1,
      },
      {
        id: '9',
        originalName: 'Bell pepper',
        unit: 'piece',
        amount: 1,
      },
      {
        id: '10',
        originalName: 'Carrots',
        unit: 'pieces',
        amount: 1-2,
      },

    ],
    CookingProcedure: '1. Take a heavy-bottomed pan, turn on the heat, and add the cooking oil.2. Dice your onions. Add the diced onion and fry until golden.3. Mince your garlic and grate your ginger. Add the garlic and ginger and stir for a few seconds.4. Add the tomato puree or paste and fry for under a minute.5. Blend your fresh tomatoes, chop your bell pepper.6. Add the blended tomatoes and chopped bell pepper.7. Add salt and seasoning. Taste to see if okay.8. Cook the sauce for about 15 to 20 minutes. Stir continuously to prevent burning.9. Allow the stew to continue cooking. Meanwhile, rinse the rice and soak it in hot (boiled) water.10. Strain the soaked rice and add it to the pot. Adjust the salt and seasoning. (if need be)11.  Add enough water to cook the rice. Bring to a boil, then lower the heat to simmer.12.  Add the carrots when the moisture has nearly gone.13. Cover the pot with clean napkin to lock in moisture and add natural cooking pressure. Next close the pot with an airtight lid and reduce the heat to low. Allow to cook gently for 20 minutes.14. Note the bottom of the pot will have a layer of caramelised Jollof with concentrated flavour. Take off the heat, and serve hot with any protein of your choice',
  },
{
    id: '2',
    title: ' Banku ',
    image: 'http://localhost:3000/2.jpg',
    cookingMinutes: '40-60mins',
    dairyFree: 'false',
    dishType: ['lunch','supper', 'dinner'],
    ingredients: [
      {
        id: '1',
        originalName: 'corn dough',
        unit: 'cups',
        amount: 2-3,
      },
      {
        id: '2',
        originalName: 'Cassava dough',
        unit: 'cups',
        amount: 1,
      },
      {
        id: '3',
        originalName: 'Salt',
        unit: 'tbsp',
        amount: 2,
      },
      {
        id: '4',
        originalName: 'Water',
        unit: 'cups',
        amount: 2-4,
      },
    ],
    CookingProcedure: '1. Mix 1 cup of water and cassava dough in a pan. Pour the mixture through a sieve to remove any residue or unmilled pieces of cassava.2. Add the corn dough to the cassava dough.3. Add the salt and mix thoroughly until the mixture becomes thin and smooth. Put the mixture in acooking pot.4.  Place the cooking pot over medium fire and continue stirring. The banku will harden as it continues to cook. Continue stirring the mixture to avoid the formation of lumps.5.  Add about one cup of water to the mixture as you continue stirring. Next, cover the pot for 5minutes to allow the Banku to cook. You can turn it over a few times to ensure even cooking6.  When ready, shape it into a small ball using a spoon. Alternatively, scoop the preferred amountinto a wet bowl and swirl around to form balls.  ',
  },
{
    id: '3',
    title: 'Garden Egg Stew  ',
    image: 'http://localhost:3000/3.jpg',
    cookingMinutes: '20-30mins',
    dairyFree: 'false',
    dishType: [' Servings '],
    ingredients: [
      {
        id: '1',
        originalName: 'Garden eggs',
        unit: 'pieces',
        amount: 5-20,
      },
      {
        id: '2',
        originalName: 'Garlic',
        unit: 'cloves',
        amount: 1-3,
      },
      {
        id: '3',
        originalName: 'Onions',
        unit: 'pieces',
        amount: 3-5,
      },
      {
        id: '4',
        originalName: 'Fresh Tomatoes',
        unit: 'pieces',
        amount: 4-5,
      },
      {
        id: '5',
        originalName: 'Medium sized Tomato paste',
        unit: 'sachet',
        amount: 1,
      },
      {
        id: '6',
        originalName: 'Red pepper ',
        unit: 'pieces',
        amount: 6-8,
      },
      {
        id: '7',
        originalName: 'Thumb sized fresh ginger',
        unit: 'pieces',
        amount: 1,
      },
      {
        id: '8',
        originalName: 'Oil',
        unit: 'tbsp',
        amount: 5-8,
      },
      {
        id: '9',
        originalName: 'Salt ',
        unit: 'tbsp',
        amount: 2-3,
      },
{
        id: '10',
        originalName: 'Bell pepper ',
        unit: 'pieces',
        amount: 1-2,
      },
{
        id: '11',
        originalName: 'Curry powder',
        unit: 'tbsp',
        amount: 0.5,
      },
    ],
    CookingProcedure: '1.  Clean the garden eggs under running water. Cut the tops, then cut them in halves.2.  Place the halved garden eggs in a saucepan, add water, and boil for boil until soft. Set aside to cool down.3.  Place another saucepan on medium heat, add oil, and sauté the diced onions. Meanwhile, blend the second onion, garlic, ginger, tomatoes, and bell pepper.4.  Add the tomato paste to the sautéd onions and allow to cook for about 2-3 minutes. 5.  Add the blended mixture and let everything cook down on medium heat for about 10 mins.6.  Add a small amount curry powder and continue cooking for 10 minutes or until thick. Meanwhile, remove the seeds from the garden eggs (optional).7.  Dice the garden eggs, then add them to the sauce. Lower the heat and let the garden eggs simmer for about 5 minutes to absorb the flavour.8. Add appreciable amount of salt to the sauce. Taste to see if okay. Add sardine (optional)9. Turn off the heat and serve with boiled yams or plantains.',
  },
{
    id: '4',
    title: 'Waakye',
    image: 'http://localhost:3000/4.jpg',
    cookingMinutes: '60',
    dairyFree: 'false',
    dishType: ['lunch', 'main course', 'supper', 'dinner'],
    ingredients: [
      {
        id: '1',
        originalName: 'Rice',
        unit: 'cups',
        amount: 2-3,
      },
      {
        id: '2',
        originalName: 'Black-eyed beans',
        unit: 'cups',
        amount: 1-1.5,
      },
      {
        id: '3',
        originalName: 'Waakye leaves/ Red sorghum leaf sheaths',
        unit: 'leaves',
        amount: 6-8,
      },
      {
        id: '4',
        originalName: 'Salt',
        unit: 'tbsp',
        amount: 2-3,
      },
    ],
    CookingProcedure: '1. Sort the beans and wash them. Place them in a cooker.2.  Wash the waakye leaves and add them to the cooker. Add water and pressure cook until the beans are fully cooked.3. Turn off the heat and allow it to cool for about 5 minutes. 4. Pour the beans with the waakye leaves and cooking liquid into another pot. Wash the rice and add it to the pot. Add more water, if needed, so there is enough to cook the rice. Add some salt and cover the pot.5. Turn on the heat and allow the rice to cook 6. Turn off the heat, remove the waakye leaves, and serve hot. Many people serve waakye with beef stew, shito, gari, spaghetti, lettuce and any protein of their choice.',
  },
  {
    id: '5',
    title: 'Braised Rice with fried egg and hot red pepper',
    image: 'http://localhost:3000/5.jpg',
    cookingMinutes: '25-40',
    dairyFree: 'false',
    dishType: ['lunch', 'main course', 'supper', 'dinner'],
    ingredients: [
      {
        id: '1',
        originalName: 'Rice',
        unit: 'cups',
        amount: 2-3,
      },
      {
        id: '2',
        originalName: 'Cooking oil',
        unit: 'tbsp',
        amount: 3-5,
      },
      {
        id: '3',
        originalName: 'Onions',
        unit: 'pieces',
        amount: 1-2,
      },
      {
        id: '4',
        originalName: 'Salt',
        unit: 'tbsp',
        amount: 1-1.5,
      },
      {
        id: '5',
        originalName: 'Pepper',
        unit: 'pieces',
        amount: 4-6,
      },
      {
        id: '6',
        originalName: 'Eggs',
        unit: 'pieces',
        amount: 1-2,
      },
      

    ],
    CookingProcedure: '1. Put appreciable amount of cooking oil in a heated saucepan and cook for about 1 minute. 2. Slice onions into smaller size and add them to the heated cooking oil. 3. Let it cook for about 2-3minutes and add your rice to the mixture 4. Stir the mixture and let it cook for about 1 minute. 5. Add water to appreciable amount of the mixture and add salt. Taste to check if the salt is okay. 6. Cover the saucepan with a lid and lave it to cook for about 15 minutes. 7. Check if all water has been absorbed and take some grains if they are hard or soft. 8. If hard, sprinkle small amount of water over the rice and lower the cooking temperature of the fire. 9. If soft, lower the cooking fire temperature and start working on your pepper. 10. Wash your pepper and onions and blend them. Add salt to enhance the taste. 11. Fry your eggs. 12. check the rice again after about 5-7 minutes and if it is soft as you want it, turn off the fire. 12. Braised rice is usually served with red hot pepper and fried eggs, sometimes with sardine and salad.  ',
  },
   {
   id: '6',
   title: 'Tombrown',
   image: 'http://localhost:3000/6.jpg',
   cookingMinutes: '5',
   dairyFree: 'false',
   dishType: ['breakfast', 'main dish', ],
   ingredients: [
     {
       id: '1',
       originalName: 'Tombrown',
       unit: '0.2-0.5',
       amount: 2-3,
     },
     {
       id: '2',
       originalName: 'Sugar',
       unit: 'tbsp',
       amount: 2-3,
     },
     {
       id: '3',
       originalName: 'Water',
       unit: 'cups',
       amount: 1-2,
     },
     {
      id: '4',
      originalName: 'Milk',
      unit: 'tbsp',
      amount: 2-3,
    },
],
CookingProcedure:'1. Pour the amount of tombrown you want to cook in a cooking pot. 2. Add water to the tombrown in the cooking pot and mix thoroughly with a laddle or your hands. 3. Mix till it becomes completely liquid. 4. Put the mixture on a low fire and keep stirring with a laddle to avoid formation of dumops. 5. Continue stirring till the mixture starts to harden. 6. Cover the cooking pot with a lid and wait for about 2-4 minutes. 7. Turm off the fire and serve your tombrown in a bowl. 8. Add suagr and milk. 9. Tombrown is usually served with bread, sometimes with eggs and margarine.'
},
{
  id: '7',
  title: 'Fried spaghetti',
  image: 'http://localhost:3000/7.jpg',
  cookingMinutes: '15-20',
  dairyFree: 'false',
  dishType: ['lunch', 'main course', 'supper', 'dinner'],
  ingredients: [
    {
      id: '1',
      originalName: 'Spaghetti',
      unit: 'medium size',
      amount: 1,
    },
    {
      id: '2',
      originalName: 'Cooking oil',
      unit: 'tbsp',
      amount: 3-5,
    },
    {
      id: '3',
      originalName: 'Salt',
      unit: 'tbsp',
      amount: 1-2,
    },
    {
      id: '4',
      originalName: 'Powdered pepper',
      unit: 'tbsp',
      amount: 1-2,
    },
    {
      id: '5',
      originalName: 'Eggs',
      unit: 'pieces',
      amount: 1-2,
    },
    {
      id: '6',
      originalName: 'Spaghetti seasoning',
      unit: 'tbsp',
      amount: 1-2,
    },
    {
      id: '7',
      originalName: 'Onions',
      unit: 'pieces',
      amount: 1-2,
    },
    {
      id: '8',
      originalName: 'Green bell pepper',
      unit: 'pieces',
      amount: 1-2,
    },
    
  ],
CookingProcedure:'1. Put water in a cooking pot and put it on fire till it boils. 2. Add your spaghetti to the boiled water while still on fire. 3. Add salt small and atste to check if okay. 4. Wash your vegetables (onions, bell pepper, carrot, etc) and cut them into smaller pieces. 5. Once your spaghetti finishes cooking, turn off the fire and drain the remaining water from it using a sieve. 6. Put cooking oil into a frying pan and put it on fire. 7. Once heated, add your vegetables and let them cook for 3-5 minutes. 8. Add your eggs to the cooking mixture and stir for about 2 minutes. 9. Add your powdered pepper and small amount of salt. 10. Add your seasoning (maggi, faricity seasoning, etc) 11. Put your spaghetti into the frying with the mixture and stir gentlely and thoroughly. 12. Taste and check if the seasoning is okay, if not you can add some to it and stir again. 13. Fried spaghetti can be served with fried sausages, eggs, sardine or meat.'
},
{
  id: '8',
  title: 'Boiled Plantain',
  image: 'http://localhost:3000/8.jpg',
  cookingMinutes: '20',
  dairyFree: 'false',
  dishType: ['lunch', 'supper', 'dinner'],
  ingredients: [
    {
      id: '1',
      originalName: 'Plantain',
      unit: 'pieces',
      amount: 3-5,
    },
    {
      id: '2',
      originalName: 'Salt',
      unit: 'tbsp',
      amount: 2-3,
    },
    {
      id: '3',
      originalName: 'Eggs',
      unit: 'pieces',
      amount: 1-2,
    },
],
CookingProcedure:'1. Peel your plantain and soak in water. 2. Wash your peeled plantain and slice them into smaller pieces. 3. Put water into your cooking pot and transfer your sliced plantain to it. 4. Add appreciable amount of salt and put the cooking pot on fire. 5. Wash your eggs and put it in the cooking pot. 6. Cover the cooking with a foil or a white plastic bag before finally covering it with a lid. 7. Let it cook for about 15-20 minutes. 8. Check to verify if the plantain is soft and turn off the fire. 9. Drain the remaining water from the plantain and transfer to a bowl. 10. Boiled plantain are usually served with tomato sauce, garden egg stew, palava sauce, etc and eggs, fish. '
},
{
  id: '9',
  title: 'Fried Plantain',
  image: 'http://localhost:3000/9.jpg',
  cookingMinutes: '15',
  dairyFree: 'true',
  dishType: ['lunch', 'dinner'],
  ingredients: [
    {
      id: '1',
      originalName: 'Riped plantain',
      unit: 'pieces',
      amount: 2-4,
    },
    {
      id: '2',
      originalName: 'Cooking oil',
      unit: 'tbsp',
      amount: 5-8,
    },
    {
      id: '3',
      originalName: 'Salt',
      unit: 'tbsp',
      amount: 2-3,
    },
],
CookingProcedure:'1. Peel your riped plantains. 2. Fill a bowl with water and add salt to it. 3. Slice the peeled plantain into smaller pieces and put them into the salty water. 4. Put a frying pan on fire and add appreciable amount of cooking oil. 5. Let the oil cook for 3-5 mnutes. 6. When the oil is now hot, wash your plantain in the salty water and put it in the oil. 7. Carefully turn the plantains in the hot oil over and over again til all have fried properly into a red looking plantain. 8. Do same for the rest of the plantains in the salty. 9. Riped plantains are usually served with hot red pepper, beans, vegetable sauce etc. and fish '
},
// {
//   id: '10',
//   title: 'Boiled Spaghetti with meat stew',
//   image: 'http://localhost:3000/10.jpg',
//   cookingMinutes: '10',
//   dairyFree: 'false',
//   dishType: ['lunch', 'main course', 'main dish', 'dinner'],
//   ingredients: [
//     {
//       id: '1',
//       originalName: '',
//       unit: '',
//       amount: '',
//     },
//     {
//       id: '2',
//       originalName: '',
//       unit: '',
//       amount: '',
//     },
//     {
//       id: '3',
//       originalName: '',
//       unit: '',
//       amount: 1-2,
//     },
// ],
// CookingProcedure:''
// },
 ]

 const saveSampleRecipes = async () => {
  try {
    // Remove existing recipes
    await Recipe.deleteMany({});
    console.log('Old recipes removed');

    // Insert new recipes
    await Recipe.insertMany(recipes);
    console.log('Recipes seeded successfully');
    
    process.exit();
  } catch (err) {
    console.error('Error seeding recipes:', err);
    process.exit(1);
  }
};

saveSampleRecipes();