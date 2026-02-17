const UserController = require('../../../src/controllers/UserController');
const { authenticateToken, requireAdmin } = require('../../../src/middleware/authMiddleware');

// Helper para manejar CORS
function handleCORS(req, res) {
    const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'https://login-shoker.vercel.app',
        process.env.FRONTEND_URL
    ].filter(Boolean);

    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (origin && origin.startsWith('http://localhost:')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}

/**
 * Endpoint para aprobar un usuario
 * PATCH /api/users/:userId/approve
 */
module.exports = async (req, res) => {
    handleCORS(req, res);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'PATCH') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
        });
    }

    try {
        // Autenticar token
        await new Promise((resolve, reject) => {
            authenticateToken(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Verificar que sea admin
        await new Promise((resolve, reject) => {
            requireAdmin(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Llamar al controlador
        await UserController.approveUser(req, res);
    } catch (error) {
        if (!res.headersSent) {
            res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error interno del servidor',
                code: error.code || 'INTERNAL_ERROR'
            });
        }
    }
};
