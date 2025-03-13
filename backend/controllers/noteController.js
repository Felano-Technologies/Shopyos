const Note = require('../models/Note');

const addNote = async (req, res) => {
  const { content } = req.body;
  try {
    const newNote = new Note({
      user: req.user.id,
      content
    });

    const note = await newNote.save();

    res.json(note);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

const getNotes = async (req, res) => {
  try {
    const notes = await Note.find({ user: req.user.id }).sort({ date: -1 });
    res.json(notes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

module.exports = {
  addNote,
  getNotes
};
