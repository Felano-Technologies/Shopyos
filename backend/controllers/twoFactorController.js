const User = require('../models/User');
const twilio = require('twilio');

const accountSid = 'ACdb99eb8a8055ec94762993dcbd7db78e';
const authToken = '7fdaaa67ddec246c8607ee8b0a9be611';
const verifyServiceSid = 'VA20f9e469c859ed56b4035ffd54495d8c'; // Twilio Verify service SID
const client = twilio(accountSid, authToken);

// Request a verification code
exports.requestVerificationCode = async (req, res) => {
  const { phone } = req.body;
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    await client.verify.services(verifyServiceSid).verifications.create({
      to: phone,
      channel: 'sms',
    });

    res.json({ success: true, msg: 'Verification code sent' });
  } catch (error) {
    console.error('Error sending verification code:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Verify the code
exports.verifyCode = async (req, res) => {
  const { phone, code } = req.body;
  try {
    const verificationCheck = await client.verify.services(verifyServiceSid).verificationChecks.create({
      to: phone,
      code: code,
    });

    if (verificationCheck.status === 'approved') {
      const user = await User.findById(req.user.id);
      user.twoFactorEnabled = true;
      await user.save();

      res.json({ success: true, msg: 'Phone verified' });
    } else {
      res.status(400).json({ error: 'Invalid code' });
    }
  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
