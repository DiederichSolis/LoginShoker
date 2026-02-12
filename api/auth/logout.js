const AuthService = require('../../src/services/AuthService');
const logger = require('../../src/utils/logger');

// Helper para manejar CORS
function handleCORS(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}

/**
 * Endpoint para logout
 * POST /api/auth/logout
 */
module.exports = async (req, res) => {
  handleCORS(res);

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
    const { refreshToken } = req.body;

    await AuthService.logout(refreshToken);

    res.status(200).json({
      success: true,
      message: 'Sesión cerrada exitosamente',
      data: null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Incluso si hay error, responder exitosamente para logout
    logger.warn('Error en logout, pero respondiendo exitosamente', error);
    
    res.status(200).json({
      success: true,
      message: 'Sesión cerrada',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
};