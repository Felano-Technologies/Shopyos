const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { decrypt, encrypt } = require('../utils/encryption');

const register = async (req, res) => {
  const { name, email, password, fullPhoneNumber } = req.body;
  try {
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      name,
      email,
      fullPhoneNumber,
      password
    });

    await user.save();

    const payload = {
      user: {
        id: user._id
      }
    };

    jwt.sign(
      payload,
      'secret',
      { expiresIn: 360000 },
      (err, token) => {
        if (err) throw err;
        res.json({ 
          token,       
          message : "User created successfully",
      });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

const login = async (req, res) => {
  const { email, password, latitude, longitude } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // Update user location if latitude & longitude are provided
    if (latitude && longitude) {
      user.latitude = latitude;
      user.longitude = longitude;
      await user.save();
    }

    const token = await encrypt(user.id.toString());
    res.status(200).json({
      token,
      message : "Login successful",
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const resetPassword = async (req, res) => {
  const { email } = req.body;
  try {
    let user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    const token = crypto.randomBytes(20).toString('hex');

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: 'your-email@gmail.com',
        pass: 'your-email-password'
      }
    });

    const mailOptions = {
      to: user.email,
      from: 'your-email@gmail.com',
      subject: 'Password Reset',
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
        Please click on the following link, or paste this into your browser to complete the process:\n\n
        http://localhost:3000/reset/${token}\n\n
        If you did not request this, please ignore this email and your password will remain unchanged.\n`
    };

    transporter.sendMail(mailOptions, (err, response) => {
      if (err) {
        console.error('there was an error: ', err);
      } else {
        res.status(200).json('recovery email sent');
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

const getUserData = async (req, res) => {
  try {
    // 1) Make sure the “Authorization” header exists and split out the token:
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }
    const token = authHeader.split(' ')[1]; // “Bearer <token>”
    if (!token) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }

    // 2) Decrypt the token to get the user’s ID
    console.log('Decrypted ID:', decoded);

    // 3) Look up the user by that _id in MongoDB
    const user = await User.findById(decoded);
    //    (or: await User.findOne({ _id: decoded }); )

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 4) Optionally re-encrypt the ID for the client if you need to
    const userId = await encrypt(user._id.toString());

    // 5) Send back only the fields you want the client to see
    res.status(200).json({
      id:      userId,       // encrypted ID, if you need it
      name:    user.name,
      email:   user.email,
      longitude: user.longitude,
      latitude:  user.latitude,
      phone:     user.phone,
    });
  } catch (error) {
    console.error('Error getting user data:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  register,
  login,
  resetPassword,
  getUserData
};