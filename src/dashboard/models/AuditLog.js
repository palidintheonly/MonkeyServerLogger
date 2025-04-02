/**
 * Audit log model - stores actions performed on the dashboard
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    // Unique ID for the log entry
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // Action performed (login, update, delete, etc.)
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Category of action (user, guild, command, etc.)
    category: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Target of the action (e.g., guild ID, user ID)
    target: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Details of the action
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue('details');
        return value ? JSON.parse(value) : {};
      },
      set(value) {
        this.setDataValue('details', JSON.stringify(value || {}));
      }
    },
    // IP address of the user
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // User agent
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    timestamps: true,
    tableName: 'audit_logs'
  });

  return AuditLog;
};