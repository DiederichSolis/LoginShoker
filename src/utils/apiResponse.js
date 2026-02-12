/**
 * Utilidad para crear respuestas consistentes de la API
 */
class ApiResponse {
  static success(res, data = null, message = 'Operación exitosa', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  static error(res, message = 'Error interno del servidor', statusCode = 500, code = null, details = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };

    if (code) response.code = code;
    if (details) response.details = details;

    return res.status(statusCode).json(response);
  }

  static validationError(res, errors, message = 'Errores de validación') {
    return res.status(400).json({
      success: false,
      message,
      code: 'VALIDATION_ERROR',
      errors,
      timestamp: new Date().toISOString()
    });
  }

  static unauthorized(res, message = 'No autorizado', code = 'UNAUTHORIZED') {
    return res.status(401).json({
      success: false,
      message,
      code,
      timestamp: new Date().toISOString()
    });
  }

  static forbidden(res, message = 'Acceso prohibido', code = 'FORBIDDEN') {
    return res.status(403).json({
      success: false,
      message,
      code,
      timestamp: new Date().toISOString()
    });
  }

  static notFound(res, message = 'Recurso no encontrado', code = 'NOT_FOUND') {
    return res.status(404).json({
      success: false,
      message,
      code,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = ApiResponse;