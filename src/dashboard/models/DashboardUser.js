/**
 * Dashboard user model - stores information about admin dashboard users
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DashboardUser = sequelize.define('DashboardUser', {
    // Discord user ID as the primary key
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    // Discord user details
    username: {
      type: DataTypes.STRING,
      allowNull: false
    },
    discriminator: {
      type: DataTypes.STRING,
      allowNull: true
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Access level: owner, admin, moderator, etc.
    accessLevel: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'guest'
    },
    // Last login timestamp
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    // Access token for API authentication
    accessToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    refreshToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // User preferences
    preferences: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue('preferences');
        return value ? JSON.parse(value) : {};
      },
      set(value) {
        this.setDataValue('preferences', JSON.stringify(value || {}));
      }
    }
  }, {
    timestamps: true,
    tableName: 'dashboard_users'
  });

  return DashboardUser;
};