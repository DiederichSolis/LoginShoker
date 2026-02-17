// Vercel Entry Point
// Delegates all requests to the main Express app in src/index.js
const app = require('../src/index');

module.exports = (req, res) => {
    return app(req, res);
};
