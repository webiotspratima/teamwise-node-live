const { TeamSetting } = require('../models');

exports.getTeamSettings = async (req, res) => {

  try {
    
    const teamSetting = await TeamSetting.findOne({
      where: { team_id: req.team_id },
    });

    return res.status(201).json({
      teamSetting
    });

  } catch (err) {
    console.error('Error in createTeam:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateTeamSetting = async (req, res) => {
  const {
    require_approval_to_join,
    invite_only,
    approved_domains,
    block_all_other_domains,
    invitation_permission,
    email_notifications_enabled,
    direct_join_enabled,
    members_can_create_channels,
    message_retention_days,
    notifications_default,
    public_channel_creation_permission,
    allowed_public_channel_creator_ids,
    private_channel_creation_permission,
    allowed_private_channel_creator_ids,
    channel_creation_limit_per_user,
    file_sharing_access,
    file_sharing_type_scope,
    allowed_file_upload_types,
    allowed_file_upload_member_ids,
    team_file_upload_limit_mb,
    member_file_upload_limit_mb,
    timezone,
    visibility,
  } = req.body;

  try {
    const teamSetting = await TeamSetting.findOne({
      where: { team_id: req.team_id },
    });

    if (!teamSetting) {
      return res.status(404).json({ message: "Team setting not found" });
    }

    await teamSetting.update({
      require_approval_to_join,
      invite_only,
      approved_domains,
      block_all_other_domains,
      invitation_permission,
      email_notifications_enabled,
      direct_join_enabled,
      members_can_create_channels,
      message_retention_days,
      notifications_default,
      public_channel_creation_permission,
      allowed_public_channel_creator_ids,
      private_channel_creation_permission,
      allowed_private_channel_creator_ids,
      channel_creation_limit_per_user,
      file_sharing_access,
      file_sharing_type_scope,
      allowed_file_upload_types,
      allowed_file_upload_member_ids,
      team_file_upload_limit_mb,
      member_file_upload_limit_mb,
      timezone,
      visibility,
    });

    return res
      .status(200)
      .json({ message: "Team setting updated successfully" });
  } catch (err) {
    console.error("Error in updateTeamSetting:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
