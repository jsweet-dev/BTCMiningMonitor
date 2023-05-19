module.exports = {
    apps: [
      {
        name: 'api-server',
        script: './server.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '3G',
      },
      {
        name: 'polling-server',
        script: './polling.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
      },
    ],
  };
  