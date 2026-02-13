const { body } = require('express-validator');
const AuthService = require('../services/AuthService');
const SessionModel = require('../models/SessionModel');
const UserModel = require('../models/UserModel');
const ApiResponse = require('../utils/apiResponse');
const AuthUtils = require('../utils/authUtils');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Controlador de autenticación
 */
class AuthController {
  /**
   * Validaciones para registro
   */
  static registerValidation = [
    body('email')
      .isEmail()
      .withMessage('Email inválido'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener al menos 8 caracteres')
      .matches(/[A-Z]/)
      .withMessage('La contraseña debe contener al menos una letra mayúscula')
      .matches(/[a-z]/)
      .withMessage('La contraseña debe contener al menos una letra minúscula')
      .matches(/[0-9]/)
      .withMessage('La contraseña debe contener al menos un número')
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage('La contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?":{}|<>)'),
    body('nombre')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('El nombre debe tener entre 2 y 100 caracteres')
  ];

  /**
   * Validaciones para login
   */
  static loginValidation = [
    body('email')
      .isEmail()
      .withMessage('Email inválido'),
    body('password')
      .notEmpty()
      .withMessage('Contraseña requerida')
  ];

  /**
   * Validaciones para refresh token
   */
  static refreshValidation = [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token requerido')
  ];

  /**
   * Validaciones para cambio de contraseña
   */
  static changePasswordValidation = [
    body('currentPassword')
      .notEmpty()
      .withMessage('Contraseña actual requerida'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('La nueva contraseña debe tener al menos 8 caracteres')
  ];

  /**
   * Registra un nuevo usuario
   * POST /api/auth/register
   */
  static register = asyncHandler(async (req, res) => {
    const { email, password, nombre } = req.body;

    try {
      const result = await AuthService.register(
        { email, password, nombre },
        {
          userAgent: req.get('User-Agent'),
          ip: AuthUtils.getRealIP(req)
        }
      );

      // Mapear id_usuario a id para compatibilidad con frontend
      const response = {
        user: {
          id: result.user.id, // Ya viene mapeado desde AuthService
          email: result.user.email,
          nombre: result.user.nombre,
          activo: result.user.activo,
          roles: result.user.roles
        },
        tokens: result.tokens
      };

      ApiResponse.success(res, response, 'Solicitud de acceso enviada. Tu cuenta está pendiente de aprobación por un administrador.', 201);
    } catch (error) {
      if (error.message === 'EMAIL_ALREADY_EXISTS') {
        return ApiResponse.error(res, 'El email ya está registrado', 409, 'EMAIL_ALREADY_EXISTS');
      }

      if (error.message === 'EMAIL_INVALID') {
        return ApiResponse.error(res, 'Formato de email inválido', 400, 'EMAIL_INVALID');
      }

      if (error.message === 'PASSWORD_WEAK') {
        return ApiResponse.validationError(res, error.details, 'La contraseña no cumple los requisitos');
      }

      throw error;
    }
  });

  /**
   * Inicia sesión de usuario
   * POST /api/auth/login
   */
  static login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    try {
      const result = await AuthService.login(
        { email, password },
        {
          userAgent: req.get('User-Agent'),
          ip: AuthUtils.getRealIP(req)
        }
      );

      // Mapear respuesta para frontend
      const response = {
        user: {
          id: result.user.id, // Ya viene mapeado desde AuthService
          email: result.user.email,
          nombre: result.user.nombre,
          activo: result.user.activo,
          roles: result.user.roles
        },
        tokens: result.tokens
      };

      ApiResponse.success(res, response, 'Inicio de sesión exitoso');
    } catch (error) {
      if (error.message === 'INVALID_CREDENTIALS') {
        return ApiResponse.unauthorized(res, 'Credenciales inválidas', 'INVALID_CREDENTIALS');
      }

      if (error.message === 'ACCOUNT_DISABLED') {
        return ApiResponse.unauthorized(res, 'Cuenta desactivada', 'ACCOUNT_DISABLED');
      }

      if (error.message === 'ACCOUNT_LOCKED') {
        return ApiResponse.unauthorized(res, 'Cuenta bloqueada', 'ACCOUNT_LOCKED');
      }

      throw error;
    }
  });

  /**
   * Renueva tokens de acceso
   * POST /api/auth/refresh
   */
  static refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    try {
      const result = await AuthService.refreshTokens(refreshToken);

      // Mapear respuesta para frontend
      const response = {
        tokens: result.tokens,
        user: {
          id: result.user.id, // Ya viene mapeado desde AuthService
          email: result.user.email,
          nombre: result.user.nombre,
          roles: result.user.roles
        }
      };

      ApiResponse.success(res, response, 'Tokens renovados exitosamente');
    } catch (error) {
      if (error.message === 'INVALID_REFRESH_TOKEN') {
        return ApiResponse.unauthorized(res, 'Refresh token inválido', 'INVALID_REFRESH_TOKEN');
      }

      if (error.message === 'SESSION_EXPIRED') {
        return ApiResponse.unauthorized(res, 'Sesión expirada', 'SESSION_EXPIRED');
      }

      throw error;
    }
  });

  /**
   * Cierra sesión del usuario
   * POST /api/auth/logout
   */
  static logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    try {
      await AuthService.logout(refreshToken);

      ApiResponse.success(res, null, 'Sesión cerrada exitosamente');
    } catch (error) {
      // Incluso si hay error, responder exitosamente para logout
      logger.warn('Error en logout, pero respondiendo exitosamente', error);
      ApiResponse.success(res, null, 'Sesión cerrada');
    }
  });

  /**
   * Cierra todas las sesiones del usuario autenticado
   * POST /api/auth/logout-all
   */
  static logoutAll = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const currentSessionId = req.session?.id;

    try {
      const invalidatedCount = await AuthService.logoutAllSessions(userId, currentSessionId);

      ApiResponse.success(res,
        { invalidatedSessions: invalidatedCount },
        'Todas las sesiones fueron cerradas'
      );
    } catch (error) {
      throw error;
    }
  });

  /**
   * Cambia la contraseña del usuario autenticado
   * POST /api/auth/change-password
   */
  static changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    try {
      await AuthService.changePassword(userId, currentPassword, newPassword);

      ApiResponse.success(res, null, 'Contraseña cambiada exitosamente');
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return ApiResponse.notFound(res, 'Usuario no encontrado', 'USER_NOT_FOUND');
      }

      if (error.message === 'INVALID_CURRENT_PASSWORD') {
        return ApiResponse.error(res, 'Contraseña actual incorrecta', 400, 'INVALID_CURRENT_PASSWORD');
      }

      if (error.message === 'PASSWORD_WEAK') {
        return ApiResponse.validationError(res, error.details, 'La nueva contraseña no cumple los requisitos');
      }

      throw error;
    }
  });

  /**
   * Obtiene información del usuario autenticado
   * GET /api/auth/me
   */
  static getProfile = asyncHandler(async (req, res) => {
    const user = req.user;

    // Obtener estadísticas de sesiones (user.id es id_usuario internamente)
    const sessionStats = await SessionModel.getUserSessionStats(user.id_usuario);

    ApiResponse.success(res, {
      user: {
        id: user.id_usuario, // Mapear a 'id' para frontend
        email: user.email,
        nombre: user.nombre,
        activo: user.activo,
        roles: user.roles || [],
        fechaCreacion: user.fecha_creacion
      },
      sessionStats
    }, 'Perfil obtenido exitosamente');
  });

  /**
   * Verifica si un token es válido
   * POST /api/auth/verify
   */
  static verifyToken = asyncHandler(async (req, res) => {
    // Si llegamos aquí, el token es válido (verificado por middleware)
    const user = req.user;

    ApiResponse.success(res, {
      valid: true,
      user: {
        id: user.id_usuario, // Mapear a 'id' para frontend
        email: user.email,
        nombre: user.nombre,
        roles: user.roles?.map(r => r.nombre) || []
      }
    }, 'Token válido');
  });

  /**
   * Obtiene sesiones activas del usuario autenticado
   * GET /api/auth/sessions
   */
  static getSessions = asyncHandler(async (req, res) => {
    const userId = req.userId; // req.userId viene del middleware (es id_usuario)

    const sessions = await SessionModel.getActiveSessions(userId);

    // Mapear id_sesion a id en cada sesión
    const mappedSessions = sessions.map(session => ({
      id: session.id_sesion,
      userAgent: session.user_agent,
      ip: session.ip,
      fechaCreacion: session.fecha_creacion,
      fechaExpiracion: session.fecha_expiracion
    }));

    ApiResponse.success(res, { sessions: mappedSessions }, 'Sesiones activas obtenidas');
  });

  /**
   * Invalida una sesión específica
   * DELETE /api/auth/sessions/:sessionId
   */
  static invalidateSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params; // sessionId es id_sesion (INTEGER)
    const userId = req.userId; // userId es id_usuario (INTEGER)

    await SessionModel.invalidateSession(parseInt(sessionId), userId);

    ApiResponse.success(res, null, 'Sesión invalidada exitosamente');
  });
}

module.exports = AuthController;