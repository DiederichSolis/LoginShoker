const { body } = require('express-validator');
const AuthService = require('../../src/services/AuthService');
const logger = require('../../src/utils/logger');

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
 * Endpoint para renovar tokens
 * POST /api/auth/refresh
 */
module.exports = async (req, res) => {
  handleCORS(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Validación
    const validation = body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token requerido');

    const result = await validation.run(req);
    if (!result.isEmpty()) {
      const errors = result.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        code: 'VALIDATION_ERROR',
        errors,
        timestamp: new Date().toISOString()
      });
    }

    const { refreshToken } = req.body;

    const refreshResult = await AuthService.refreshTokens(refreshToken);

    res.status(200).json({
      success: true,
      message: 'Tokens renovados exitosamente',
      data: refreshResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error renovando tokens', error);

    if (error.message === 'INVALID_REFRESH_TOKEN') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido',
        code: 'INVALID_REFRESH_TOKEN',
        timestamp: new Date().toISOString()
      });
    }

    if (error.message === 'SESSION_EXPIRED') {
      return res.status(401).json({
        success: false,
        message: 'Sesión expirada',
        code: 'SESSION_EXPIRED',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor'
        : error.message,
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};