/** @type {import('jest').Config} */
module.exports = {
  projects: [
    "<rootDir>/apps/api-gateway",
    "<rootDir>/apps/user-service",
    "<rootDir>/apps/producer-service",
    "<rootDir>/apps/offer-service",
    "<rootDir>/apps/rescue-service",
    "<rootDir>/apps/demand-service",
    "<rootDir>/apps/inventory-service",
    "<rootDir>/apps/logistics-service",
    "<rootDir>/apps/incident-service",
    "<rootDir>/apps/notification-service",
    "<rootDir>/apps/analytics-service",
    "<rootDir>/apps/ml-service",
    "<rootDir>/apps/automation-service",
    "<rootDir>/apps/auction-service",
    "<rootDir>/apps/shared",
    "<rootDir>/tests/integration"
  ]
};
