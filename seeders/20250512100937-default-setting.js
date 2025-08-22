'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('settings', [{
      app_name: 'My App',
      support_email: 'no-reply@mysaas.com',
      logo_url: '',
      created_at: new Date(),
      updated_at: new Date()
    }]);

  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('settings', null, {});
  }
};
