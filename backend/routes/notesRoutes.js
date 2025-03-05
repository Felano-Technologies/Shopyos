const express = require('express');
const { addNote, getNotes } = require('../controllers/noteController');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/', auth, addNote);
router.get('/', auth, getNotes);

module.exports = router;
