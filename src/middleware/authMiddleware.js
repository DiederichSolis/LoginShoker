const AuthUtils = require('../utils/authUtils');
const ApiResponse = require('../utils/apiResponse');
const UserModel = require('../models/UserModel');
const SessionModel = require('../models/SessionModel');
const RoleModel = require('../models/RoleModel');
const logger = require('../utils/logger');

/**
 * Middleware de autenticación JWT
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return ApiResponse.unauthorized(res, 'Token de acceso requerido', 'TOKEN_REQUIRED');
    }

    // Verificar JWT
    const decoded = AuthUtils.verifyJWT(token);
    
    // Obtener información completa del usuario
    const user = await UserModel.findWithRoles(decoded.userId);
    
    if (!user) {
      return ApiResponse.unauthorized(res, 'Usuario no encontrado', 'USER_NOT_FOUND');
    }

    if (!user.activo) {
      return ApiResponse.unauthorized(res, 'Cuenta desactivada', 'ACCOUNT_DISABLED');
    }

    if (user.bloqueado) {
      return ApiResponse.unauthorized(res, 'Cuenta bloqueada', 'ACCOUNT_LOCKED');
    }

    // Agregar usuario al request
    req.user = user;
    req.userId = user.id_usuario; // Usar id_usuario internamente
    req.userRoles = user.roles || [];

    next();
  } catch (error) {
    logger.error('Error en autenticación', error);
    
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.unauthorized(res, 'Token expirado', 'TOKEN_EXPIRED');
    }
    
    if (error.name === 'JsonWebTokenError') {
      return ApiResponse.unauthorized(res, 'Token inválido', 'INVALID_TOKEN');
    }

    return ApiResponse.error(res, 'Error de autenticación', 500);
  }
};

/**
 * Middleware de autenticación opcional
 * Similar a authenticateToken pero no falla si no hay token
 */
const optionalAuthentication = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // No hay token, continuar sin usuario
      req.user = null;
      req.userId = null;
      req.userRoles = [];
      return next();
    }

    // Si hay token, validarlo
    const decoded = AuthUtils.verifyJWT(token);
    const user = await UserModel.findWithRoles(decoded.userId);
    
    if (user && user.activo && !user.bloqueado) {
      req.user = user;
      req.userId = user.id_usuario; // Usar id_usuario internamente
      req.userRoles = user.roles || [];
    } else {
      req.user = null;
      req.userId = null;
      req.userRoles = [];
    }

    next();
  } catch (error) {
    // En caso de error, continuar sin usuario
    req.user = null;
    req.userId = null;
    req.userRoles = [];
    next();
  }
};

/**
 * Middleware para validar refresh token
 */
const validateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return ApiResponse.unauthorized(res, 'Refresh token requerido', 'REFRESH_TOKEN_REQUIRED');
    }

    // Buscar sesión
    const session = await SessionModel.findByRefreshToken(refreshToken);
    
    if (!session) {
      return ApiResponse.unauthorized(res, 'Sesión no válida', 'INVALID_SESSION');
    }

    // Verificar si la sesión es válida
    const isValid = await SessionModel.isValidSession(refreshToken);
    
    if (!isValid) {
      return ApiResponse.unauthorized(res, 'Sesión expirada o inválida', 'SESSION_EXPIRED');
    }

    // Agregar sesión y usuario al request
    req.session = session;
    req.user = session.usuarios;
    req.userId = session.usuarios.id_usuario; // Usar id_usuario

    next();
  } catch (error) {
    logger.error('Error en validación de refresh token', error);
    return ApiResponse.error(res, 'Error al validar sesión', 500);
  }
};

/**
 * Middleware para autorización por roles
 */
const requireRole = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return ApiResponse.unauthorized(res, 'Autenticación requerida', 'AUTHENTICATION_REQUIRED');
      }

      const userRoles = req.userRoles || [];
      const userRoleNames = userRoles.map(role => role.nombre.toLowerCase());
      const requiredRoles = roles.map(role => role.toLowerCase());

      // Verificar si el usuario tiene alguno de los roles requeridos
      const hasRequiredRole = requiredRoles.some(role => userRoleNames.includes(role));

      if (!hasRequiredRole) {
        return ApiResponse.forbidden(res, 
          `Se requiere uno de los siguientes roles: ${requiredRoles.join(', ')}`,
          'INSUFFICIENT_PERMISSIONS'
        );
      }

      next();
    } catch (error) {
      logger.error('Error en autorización de roles', error);
      return ApiResponse.error(res, 'Error de autorización', 500);
    }
  };
};

/**
 * Middleware para verificar si el usuario es admin
 */
const requireAdmin = requireRole('admin');

/**
 * Middleware para verificar propiedad del recurso o admin
 */
const requireOwnershipOrAdmin = (getUserIdFromParams = (req) => req.params.userId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return ApiResponse.unauthorized(res, 'Autenticación requerida', 'AUTHENTICATION_REQUIRED');
      }

      const targetUserId = getUserIdFromParams(req);
      const currentUserId = req.userId;
      const userRoles = req.userRoles || [];
      const isAdmin = userRoles.some(role => role.nombre.toLowerCase() === 'admin');

      // El usuario puede acceder si es admin o es el dueño del recurso
      if (isAdmin || currentUserId === targetUserId) {
        next();
      } else {
        return ApiResponse.forbidden(res, 
          'No tienes permisos para acceder a este recurso',
          'ACCESS_DENIED'
        );
      }
    } catch (error) {
      logger.error('Error en verificación de propiedad', error);
      return ApiResponse.error(res, 'Error de autorización', 500);
    }
  };
};

/**
 * Middleware para logging de requests autenticados
 */
const logAuthenticatedRequest = (req, res, next) => {
  if (req.user) {
    logger.debug('Request autenticado', {
      userId: req.userId,
      email: req.user.email,
      roles: req.userRoles?.map(r => r.nombre),
      method: req.method,
      path: req.path,
      ip: AuthUtils.getRealIP(req)
    });
  }
  next();
};

/**
 * Middleware para validar que el usuario esté activo
 */
const requireActiveUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Autenticación requerida', 'AUTHENTICATION_REQUIRED');
    }

    // Verificar estado actualizado del usuario
    const currentUser = await UserModel.findById(req.userId);
    
    if (!currentUser) {
      return ApiResponse.unauthorized(res, 'Usuario no encontrado', 'USER_NOT_FOUND');
    }

    if (!currentUser.activo) {
      return ApiResponse.unauthorized(res, 'Cuenta desactivada', 'ACCOUNT_DISABLED');
    }

    if (currentUser.bloqueado) {
      return ApiResponse.unauthorized(res, 'Cuenta bloqueada', 'ACCOUNT_LOCKED');
    }

    next();
  } catch (error) {
    logger.error('Error al verificar usuario activo', error);
    return ApiResponse.error(res, 'Error de validación de usuario', 500);
  }
};

module.exports = {
  authenticateToken,
  optionalAuthentication,
  validateRefreshToken,
  requireRole,
  requireAdmin,
  requireOwnershipOrAdmin,
  logAuthenticatedRequest,
  requireActiveUser
};