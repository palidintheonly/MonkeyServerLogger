/**
 * Metrics data model - stores performance and usage metrics
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MetricsData = sequelize.define('MetricsData', {
    // Unique ID for the metrics entry
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // Type of metric (command_usage, api_call, error, etc.)
    metricType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Name of specific metric (ping, setup, help, etc.)
    metricName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Count or value
    value: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 1
    },
    // Associated guild ID (if applicable)
    guildId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Associated user ID (if applicable)
    userId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Additional data
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue('metadata');
        return value ? JSON.parse(value) : {};
      },
      set(value) {
        this.setDataValue('metadata', JSON.stringify(value || {}));
      }
    },
    // Time bucket (hourly, daily, etc.) for aggregation
    timeBucket: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    timestamps: true,
    tableName: 'metrics_data',
    indexes: [
      {
        fields: ['createdAt']
      },
      {
        fields: ['metricType', 'metricName']
      }
    ]
  });

  return MetricsData;
};