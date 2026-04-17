const jwtConfig = {
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  expiresIn: {
    pauta:      process.env.JWT_ACCESS_EXPIRY_GGSS       || '30m',
    libre:      process.env.JWT_ACCESS_EXPIRY_GGSS       || '30m',
    supervisor: process.env.JWT_ACCESS_EXPIRY_SUPERVISOR || '2h',
    central:    process.env.JWT_ACCESS_EXPIRY_ADMIN      || '4h',
    admin:      process.env.JWT_ACCESS_EXPIRY_ADMIN      || '4h',
  },
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
};

module.exports = { jwtConfig };
