const bcrypt = require('bcryptjs');
const { User } = require('../models');

// Get User Details
exports.getUserDetails = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const user = await User.findOne({
      where: { id: userId },
      attributes: ['name', 'avatar', 'phone', 'country', 'country_code', 'email', 'role']
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Error getUserDetails:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Update Profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;

    const { name, phone, country, country_code } = req.body;

    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const avatar = req.file ? `/uploads/avatars/${req.file.filename}` : user.avatar;

    await user.update({
      name: name ?? user.name,
      avatar: avatar,
      phone: phone ?? user.phone,
      country: country ?? user.country,
      country_code: country_code ?? user.country_code,
    });

    const updatedUser = await User.findByPk(userId, {
      attributes: ['name', 'avatar', 'phone', 'country', 'country_code', 'email']
    });

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
  
// Update Password
exports.updatePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { old_password, password } = req.body;

    if (!old_password || !password) {
      return res.status(404).json({ message: 'Old password and new password are required' });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(old_password, user.password);
    if (!isPasswordValid) {
      return res.status(404).json({ message: 'Invalid old password' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await user.update({ password: hashedPassword, updated_at: new Date() });
  
    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
