const SessionModel = require('../../src/models/SessionModel');
const UserModel = require('../../src/models/UserModel');
const AuthUtils = require('../../src/utils/authUtils');
const logger = require('../../src/utils/logger');

// Helper para manejar CORS
function handleCORS(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}

// Helper para autenticación
async function authenticateToken(req) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return { error: 'Token de acceso requerido', code: 'TOKEN_REQUIRED' };
    }

    // Verificar JWT
    const decoded = AuthUtils.verifyJWT(token);
    
    // Obtener información completa del usuario
    const user = await UserModel.findWithRoles(decoded.userId);
    
    if (!user) {
      return { error: 'Usuario no encontrado', code: 'USER_NOT_FOUND' };
    }

    if (!user.activo) {
      return { error: 'Cuenta desactivada', code: 'ACCOUNT_DISABLED' };
    }

    if (user.bloqueado) {
      return { error: 'Cuenta bloqueada', code: 'ACCOUNT_LOCKED' };
    }

    return { user };
  } catch (error) {
    logger.error('Error en autenticación', error);
    
    if (error.name === 'TokenExpiredError') {
      return { error: 'Token expirado', code: 'TOKEN_EXPIRED' };
    }
    
    if (error.name === 'JsonWebTokenError') {
      return { error: 'Token inválido', code: 'INVALID_TOKEN' };
    }

    return { error: 'Error de autenticación', code: 'AUTH_ERROR' };
  }
}

/**
 * Endpoint para obtener sesiones activas del usuario
 * GET /api/sessions/index
 */
module.exports = async (req, res) => {
  handleCORS(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Autenticar usuario
    const authResult = await authenticateToken(req);
    
    if (authResult.error) {
      return res.status(401).json({
        success: false,
        message: authResult.error,
        code: authResult.code,
        timestamp: new Date().toISOString()
      });
    }

    const user = authResult.user;
    const sessions = await SessionModel.getActiveSessions(user.id);

    res.status(200).json({
      success: true,
      message: 'Sesiones activas obtenidas exitosamente',
      data: { sessions },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error obteniendo sesiones', error);
    
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