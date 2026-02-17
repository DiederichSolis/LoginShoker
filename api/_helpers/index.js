const UserModel = require('../../src/models/UserModel');
const AuthUtils = require('../../src/utils/authUtils');
const logger = require('../../src/utils/logger');

/**
 * Helpers compartidos para endpoints de Vercel
 */

/**
 * Configura headers CORS
 */
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
  } else {
    // En desarrollo, permitir cualquier origen localhost
    if (origin && origin.startsWith('http://localhost:')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}

/**
 * Maneja requests OPTIONS
 */
function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * Valida método HTTP
 */
function validateMethod(req, res, allowedMethods = []) {
  if (!allowedMethods.includes(req.method)) {
    res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
      code: 'METHOD_NOT_ALLOWED',
      timestamp: new Date().toISOString()
    });
    return false;
  }
  return true;
}

/**
 * Autentica token JWT
 */
async function authenticateToken(req) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return { error: 'Token de acceso requerido', code: 'TOKEN_REQUIRED', status: 401 };
    }

    // Verificar JWT
    const decoded = AuthUtils.verifyJWT(token);

    // Obtener información completa del usuario
    const user = await UserModel.findWithRoles(decoded.userId);

    if (!user) {
      return { error: 'Usuario no encontrado', code: 'USER_NOT_FOUND', status: 401 };
    }

    if (!user.activo) {
      return { error: 'Cuenta desactivada', code: 'ACCOUNT_DISABLED', status: 401 };
    }

    if (user.bloqueado) {
      return { error: 'Cuenta bloqueada', code: 'ACCOUNT_LOCKED', status: 401 };
    }

    return { user, userId: user.id, userRoles: user.roles || [] };
  } catch (error) {
    logger.error('Error en autenticación', error);

    if (error.name === 'TokenExpiredError') {
      return { error: 'Token expirado', code: 'TOKEN_EXPIRED', status: 401 };
    }

    if (error.name === 'JsonWebTokenError') {
      return { error: 'Token inválido', code: 'INVALID_TOKEN', status: 401 };
    }

    return { error: 'Error de autenticación', code: 'AUTH_ERROR', status: 500 };
  }
}

/**
 * Verifica si usuario tiene rol específico
 */
function hasRole(userRoles, roleName) {
  return userRoles.some(role => role.nombre.toLowerCase() === roleName.toLowerCase());
}

/**
 * Verifica si usuario tiene alguno de los roles especificados
 */
function hasAnyRole(userRoles, roleNames) {
  const lowerRoleNames = roleNames.map(name => name.toLowerCase());
  return userRoles.some(role => lowerRoleNames.includes(role.nombre.toLowerCase()));
}

/**
 * Respuesta de éxito estandarizada
 */
function successResponse(res, data = null, message = 'Operación exitosa', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Respuesta de error estandarizada
 */
function errorResponse(res, message = 'Error interno del servidor', statusCode = 500, code = null, details = null) {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (code) response.code = code;
  if (details) response.details = details;

  return res.status(statusCode).json(response);
}

/**
 * Ejecuta validaciones de express-validator
 */
async function runValidations(req, validations) {
  const errors = [];

  for (let validation of validations) {
    const result = await validation.run(req);
    if (!result.isEmpty()) {
      errors.push(...result.array());
    }
  }

  if (errors.length > 0) {
    return {
      hasErrors: true,
      errors: errors.map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }))
    };
  }

  return { hasErrors: false };
}

/**
 * Obtiene IP real del request
 */
function getRealIP(req) {
  return req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown';
}

module.exports = {
  handleCORS,
  handleOptions,
  validateMethod,
  authenticateToken,
  hasRole,
  hasAnyRole,
  successResponse,
  errorResponse,
  runValidations,
  getRealIP
};