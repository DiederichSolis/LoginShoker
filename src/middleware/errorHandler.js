const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Middleware global de manejo de errores
 */
const errorHandler = (error, req, res, next) => {
  // Log del error
  logger.error('Error no manejado', error, {
    method: req.method,
    path: req.path,
    body: req.body,
    params: req.params,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Errores de validación de Supabase
  if (error.code === '23505') {
    return ApiResponse.error(res, 'Datos duplicados', 409, 'DUPLICATE_DATA');
  }

  if (error.code === '23503') {
    return ApiResponse.error(res, 'Referencia inválida', 400, 'INVALID_REFERENCE');
  }

  // Errores de autenticación personalizados
  if (error.message === 'EMAIL_ALREADY_EXISTS') {
    return ApiResponse.error(res, 'El email ya está registrado', 409, 'EMAIL_ALREADY_EXISTS');
  }

  if (error.message === 'ROLE_ALREADY_EXISTS') {
    return ApiResponse.error(res, 'El rol ya existe', 409, 'ROLE_ALREADY_EXISTS');
  }

  if (error.message === 'ROLE_ALREADY_ASSIGNED') {
    return ApiResponse.error(res, 'El rol ya está asignado al usuario', 409, 'ROLE_ALREADY_ASSIGNED');
  }

  if (error.message === 'ROLE_HAS_USERS') {
    return ApiResponse.error(res, 'No se puede eliminar el rol porque tiene usuarios asignados', 400, 'ROLE_HAS_USERS');
  }

  // Errores de JWT
  if (error.name === 'TokenExpiredError') {
    return ApiResponse.unauthorized(res, 'Token expirado', 'TOKEN_EXPIRED');
  }

  if (error.name === 'JsonWebTokenError') {
    return ApiResponse.unauthorized(res, 'Token inválido', 'INVALID_TOKEN');
  }

  // Error de sintaxis JSON
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return ApiResponse.error(res, 'JSON inválido en el cuerpo de la solicitud', 400, 'INVALID_JSON');
  }

  // Errores de Supabase generales
  if (error.message && error.message.includes('JWT')) {
    return ApiResponse.unauthorized(res, 'Sesión inválida', 'INVALID_SESSION');
  }

  // Error por defecto
  const statusCode = error.statusCode || error.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Error interno del servidor' 
    : error.message || 'Error interno del servidor';

  return ApiResponse.error(res, message, statusCode, 'INTERNAL_ERROR');
};

/**
 * Middleware para manejar rutas no encontradas
 */
const notFoundHandler = (req, res, next) => {
  ApiResponse.notFound(res, `La ruta ${req.originalUrl} no fue encontrada`);
};

/**
 * Middleware para capturar errores asíncronos
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};