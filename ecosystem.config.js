module.exports = {
  apps: [
    {
      name: 'teamwise-api',               // Name of your app
      script: './server.js',             // Path to your main file (could be app.js, index.js, server.js, etc.)
      instances: 1,                   // Number of instances (use 'max' for cluster mode)
      autorestart: true,              // Auto restart if app crashes
      watch: true,                    // Enable file watching for changes
      max_memory_restart: '1G',       // Restart if memory usage exceeds 1GB
      env: {
        NODE_ENV: 'development',     // Environment variable for development
      },
      env_production: {
        NODE_ENV: 'production',      // Environment variable for production
      }
    }
  ]
};
