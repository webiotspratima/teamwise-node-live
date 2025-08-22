const { Setting } = require('../models');

exports.getSettings = async (req, res) => {
  try {
    const setting = await Setting.findOne();

    if (!setting) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const settings = setting.toJSON(); // or setting.get({ plain: true })

    return res.status(200).json({ settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


exports.updateSettings = async (req, res) => {
  try {
    const {
      app_name,
      support_email,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      mail_from_name,
      mail_from_email,
    } = req.body;

    const settings = await Setting.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const logo_url = req.file ? `/uploads/logos/${req.file.filename}` : undefined;

    await settings.update({
      app_name,
      support_email,
      logo_url,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      mail_from_name,
      mail_from_email
    });

    return res.status(200).json({ message: 'Settings updated successfully', settings });
  } catch (err) {
    console.error('Error updating settings:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
