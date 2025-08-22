'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.js')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

const { DataTypes } = Sequelize; // Import DataTypes from Sequelize

// Import Models
db.User = require('./user.model')(sequelize, DataTypes);
db.OTPLog = require('./otp-log.model')(sequelize, DataTypes);
db.Team = require('./team.model')(sequelize, DataTypes);
db.TeamMember = require('./team-member.model')(sequelize, DataTypes);
db.TeamSetting = require('./team-setting.model')(sequelize, DataTypes);
db.Channel = require('./channel.model')(sequelize, DataTypes);
db.ChannelMember = require('./channel-member.model')(sequelize, DataTypes);
db.ChannelSetting = require('./channel-setting.model')(sequelize, DataTypes);
db.CustomField = require('./custom-field.model')(sequelize, DataTypes);
db.Session = require('./session.model')(sequelize, DataTypes);
db.Message = require('./message.model')(sequelize, DataTypes);
db.PinnedConversation = require('./pinned-conversation.model')(sequelize, DataTypes);
db.MessageStatus = require('./message-status.model')(sequelize, DataTypes);

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
});

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
