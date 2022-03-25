const port = process.env.PORT || 8000;

module.exports = {
    launch: {
        headless: false,
        args: [
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
        ],
    },
    server: {
        command: `npm run test:e2e:start -- ${port}`,
        port,
    },
};
