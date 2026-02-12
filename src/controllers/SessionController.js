const { body, param } = require('express-validator');
const SessionModel = require('../models/SessionModel');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Controlador de sesiones
 */
class SessionController {
  /**
   * Obtiene sesiones activas del usuario autenticado
   * GET /api/sessions
   */
  static getSessions = asyncHandler(async (req, res) => {
    const userId = req.userId; // userId es id_usuario

    const sessions = await SessionModel.getActiveSessions(userId);
    
    // Mapear id_sesion a id para compatibilidad con frontend
    const mappedSessions = sessions.map(session => ({
      id: session.id_sesion,
      userAgent: session.user_agent,
      ip: session.ip,
      fechaCreacion: session.fecha_creacion,
      fechaExpiracion: session.fecha_expiracion
    }));
    
    ApiResponse.success(res, { sessions: mappedSessions }, 'Sesiones activas obtenidas exitosamente');
  });

  /**
   * Obtiene estadísticas de sesiones del usuario autenticado
   * GET /api/sessions/stats
   */
  static getSessionStats = asyncHandler(async (req, res) => {
    const userId = req.userId;

    const stats = await SessionModel.getUserSessionStats(userId);
    
    ApiResponse.success(res, { stats }, 'Estadísticas de sesiones obtenidas exitosamente');
  });

  /**
   * Invalida una sesión específica
   * DELETE /api/sessions/:sessionId
   */
  static invalidateSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params; // sessionId viene como string del URL
    const userId = req.userId; // userId es id_usuario

    // Verificar que la sesión pertenece al usuario
    const sessions = await SessionModel.getActiveSessions(userId);
    const sessionExists = sessions.some(session => session.id_sesion === parseInt(sessionId));

    if (!sessionExists) {
      return ApiResponse.notFound(res, 'Sesión no encontrada', 'SESSION_NOT_FOUND');
    }

    await SessionModel.invalidateSession(parseInt(sessionId), userId);
    
    ApiResponse.success(res, null, 'Sesión invalidada exitosamente');
  });

  /**
   * Invalida todas las sesiones del usuario excepto la actual
   * DELETE /api/sessions/all
   */
  static invalidateAllSessions = asyncHandler(async (req, res) => {
    const userId = req.userId; // userId es id_usuario
    const currentSessionId = req.session?.id_sesion; // id_sesion si existe

    const invalidatedCount = await SessionModel.invalidateAllUserSessions(userId, currentSessionId);
    
    ApiResponse.success(res, 
      { invalidatedSessions: invalidatedCount },
      'Todas las demás sesiones fueron invalidadas'
    );
  });

  /**
   * Limpia sesiones expiradas (solo admin)
   * DELETE /api/sessions/cleanup
   */
  static cleanupExpiredSessions = asyncHandler(async (req, res) => {
    const cleanedCount = await SessionModel.cleanExpiredSessions();
    
    ApiResponse.success(res, 
      { cleanedSessions: cleanedCount },
      `${cleanedCount} sesiones expiradas fueron limpiadas`
    );
  });
}

module.exports = SessionController;