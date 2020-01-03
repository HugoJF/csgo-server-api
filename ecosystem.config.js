module.exports = {
    apps: [{
        name: 'csgo-server-api',
        cwd: './build',
        script: 'index.js',

        // Options reference: https://pm2.keymetrics.io/docs/usage/application-declaration/
        args: '',
        autorestart: true,
        watch: false,
        time: true,
    }],
};