const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, OTPLog, Session, TeamMember } = require('../models');
const { sendMail } = require('../utils/mail');
const { generateToken } = require('../utils/jwt');

function generateOTP() {
  return 123456;
  // return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

exports.checkEmailAndSendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    const existingUser = await User.findOne({ where: { email: email.toLowerCase().trim() } });

    if (existingUser && existingUser.email_verified && existingUser.password) {
      return res.status(200).json({
        message: 'User exists. Please login.',
        userExists: true,
        emailVerified: true,
        isProfileUpdated: true
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins from now

    await OTPLog.create({
      email: email.toLowerCase().trim(),
      otp,
      expires_at: expiresAt
    });

    await sendMail(email, 'Your OTP Code', `Your OTP code is: ${otp}`);

    res.status(200).json({
      message: 'OTP sent successfully',
      userExists: existingUser ? true : false,
      emailVerified: existingUser && existingUser.email_verified ? true : false,
      isProfileUpdated: existingUser && existingUser.password ? true : false
    });

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const otpLog = await OTPLog.findOne({
      where: {
        email: email.toLowerCase().trim(),
        otp,
        verified: false
      },
      order: [['created_at', 'DESC']]
    });

    if (!otpLog) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    if (otpLog.expires_at < new Date()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    otpLog.verified = true;
    await otpLog.save();

    let showProfileScreen = false;
    const user = await User.findOne({ where: { email: email } });

    if (user) {
      await user.update({ email_verified: true });

      const teamMemberships = await TeamMember.findAll({
        where: { user_id: user.id }
      });

      const hasActiveMembership = teamMemberships.some(
        (tm) => tm.status === 'active'
      );

      // Logic for showing profile screen
      showProfileScreen = !user.password && hasActiveMembership;
    }

    res.status(200).json({ 
      message: 'OTP verified successfully',
      showProfileScreen
    });
    
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.resendOTP = async (req, res) => {
  try {

    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const otpLog = await OTPLog.findOne({
      where: {
        email: email.toLowerCase().trim(),
        verified: false
      },
      order: [['created_at', 'DESC']]
    });

    if (otpLog.expires_at < new Date()) {

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins from now

      await OTPLog.create({
        email: email.toLowerCase().trim(),
        otp,
        expires_at: expiresAt
      });

      await sendMail(email, 'Your OTP Code', `Your OTP code is: ${otp}`);

    } else {
      otpLog.expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 mins from now
      otpLog.save();
      await sendMail(email, 'Your OTP Code', `Your OTP code is: ${otpLog.otp}`);
    }

    res.status(200).json({ message: 'OTP verified successfully' });

  } catch (error) {
    console.error('Error resend OTP:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.login = async (req, res) => {
  const { email, password, agenda } = req.body;
  const ip_address = req.ip;

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res
        .status(400)
        .json({ message: "User not found. Please register." });
    }

    if (user && !user.email_verified) {
      return res
        .status(400)
        .json({ message: "Email is not verified, Please verify email first." });
    }

    if (user && user.status == "deactive") {
      return res
        .status(400)
        .json({
          message: "Your account is deactivated, Please contact adminitrator.",
        });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password." });
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email.toLowerCase().trim(),
    });

    const sessionLimit = 10;

    // Count existing active sessions
    const activeSessions = await Session.findAll({
      where: {
        user_id: user.id,
        status: "active",
        device_info: req.headers["user-agent"],
      },
      order: [["created_at", "ASC"]],
    });

    if (activeSessions.length >= sessionLimit) {
      // Remove oldest session
      const oldest = activeSessions[0];
      await oldest.destroy();
    }

    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Token valid for 7 days

    await Session.create({
      user_id: user.id,
      session_token: token,
      device_info: req.headers["user-agent"],
      ip_address,
      agenda: agenda || "login",
      expires_at,
    });

    // Update last_login
    await user.update({ last_login: new Date() });

    // Fetch active teams
    const teamMemberships = await TeamMember.findAll({
      where: {
        user_id: user.id,
        status: "active",
      },
    });

    const teamCount = teamMemberships.length;
    let teamId = null;
    let teamMemberRole = null;

    if (teamCount === 1) {
      teamId = teamMemberships[0].team_id;
      teamMemberRole = teamMemberships[0].role;
    }

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      showTeamsScreen: teamCount > 1,
      teamId,
      teamMemberRole,
    });
    
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }

};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const otp = generateOTP();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // expires in 10 min

    await OTPLog.create({
      email: email.toLowerCase().trim(),
      otp,
      expires_at,
      verified: false
    });

    await sendMail(email, 'Password Reset OTP', `Your OTP is: ${otp}`);

    return res.status(200).json({ message: 'OTP sent to your email.' });

  } catch (err) {
    console.error('Forgot Password Error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }

};

exports.resetPassword = async (req, res) => {
  const { email, otp, new_password } = req.body;

  try {
    const otpRecord = await OTPLog.findOne({
      where: {
        email,
        otp,
        verified: true,
        expires_at: { [Op.gt]: new Date() }
      },
      order: [['created_at', 'DESC']]
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or session expired.' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await user.update({ password: hashedPassword });

    otpRecord.verified = true;
    await otpRecord.save();

    return res.status(200).json({ message: 'Password reset successful.' });

  } catch (err) {
    console.error('Reset Password Error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
