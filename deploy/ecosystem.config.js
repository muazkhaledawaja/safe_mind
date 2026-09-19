// PM2 process file. Run with: pm2 start deploy/ecosystem.config.js --env production
module.exports = {
  apps: [
    {
      name: 'safe-mind-api',
      script: 'src/server.js',
      cwd: '..',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '300M',
      autorestart: true,
      watch: false,
    },
  ],
};
