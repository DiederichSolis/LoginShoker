const UserModel = require('../models/UserModel');
const SessionModel = require('../models/SessionModel');
const RoleModel = require('../models/RoleModel');
const AuthUtils = require('../utils/authUtils');
const logger = require('../utils/logger');

/**
 * Servicio de autenticación
 */
class AuthService {
  /**
   * Registra un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @param {Object} sessionData - Datos de la sesión
   * @returns {Promise<Object>} Usuario registrado con tokens
   */
  static async register({ email, password, nombre }, { userAgent, ip }) {
    try {
      // Validar email
      if (!AuthUtils.isValidEmail(email)) {
        throw new Error('EMAIL_INVALID');
      }

      // Validar contraseña
      const passwordValidation = AuthUtils.validatePassword(password);
      if (!passwordValidation.isValid) {
        const error = new Error('PASSWORD_WEAK');
        error.details = passwordValidation.errors;
        throw error;
      }

      // Crear usuario INACTIVO (pendiente de aprobación)
      const user = await UserModel.createUser({
        email: email.toLowerCase(),
        password,
        nombre,
        activo: false,  // Usuario inactivo hasta que admin lo apruebe
        bloqueado: false
      });

      logger.info('Usuario creado (pendiente de aprobación)', {
        userId: user.id_usuario,
        email
      });

      // Asignar rol 5 (colaborador) por defecto
      // Este rol indica que el usuario está pendiente de aprobación
      const colaboradorRoleId = 5;
      await UserModel.assignRole(user.id_usuario, colaboradorRoleId);

      logger.info('Rol colaborador asignado', {
        userId: user.id_usuario,
        roleId: colaboradorRoleId
      });

      // Crear sesión
      const session = await SessionModel.createSession({
        userId: user.id_usuario,
        userAgent,
        ip,
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
      });

      // Obtener usuario con roles
      const userWithRoles = await UserModel.findWithRoles(user.id_usuario);

      // Generar tokens
      const accessToken = AuthUtils.generateJWT(
        {
          userId: user.id_usuario,
          email: user.email,
          roles: userWithRoles.roles?.map(r => r.nombre) || []
        },
        process.env.JWT_EXPIRES_IN || '15m'
      );

      logger.info('Usuario registrado exitosamente (pendiente de aprobación)', {
        userId: user.id_usuario,
        email: user.email
      });

      return {
        user: {
          id: user.id_usuario,
          email: user.email,
          nombre: user.nombre,
          activo: user.activo,
          roles: userWithRoles.roles || []
        },
        tokens: {
          accessToken,
          refreshToken: session.refresh_token,
          expiresIn: process.env.JWT_EXPIRES_IN || '15m'
        }
      };
    } catch (error) {
      logger.error('Error en registro', error);
      throw error;
    }
  }

  /**
   * Inicia sesión de usuario
   * @param {Object} credentials - Credenciales del usuario
   * @param {Object} sessionData - Datos de la sesión
   * @returns {Promise<Object>} Usuario autenticado con tokens
   */
  static async login({ email, password }, { userAgent, ip }) {
    try {

      // Buscar usuario
      logger.info('Login recibido', { emailRecibido: email });
      const user = await UserModel.findByEmail(email);
      logger.info('Usuario encontrado', { emailEncontrado: user?.email, hash: user?.password_hash });

      if (!user) {
        logger.warn('Usuario no encontrado', { email });
        throw new Error('INVALID_CREDENTIALS');
      }

      if (!user.activo) {
        logger.warn('Cuenta deshabilitada', { email });
        throw new Error('ACCOUNT_DISABLED');
      }

      if (user.bloqueado) {
        logger.warn('Cuenta bloqueada', { email });
        throw new Error('ACCOUNT_LOCKED');
      }

      // DEBUG: mostrar información mínima para verificar que estamos leyendo el hash correcto
      logger.debug('Verificando contraseña del usuario', {
        email: user.email,
        passwordHashPrefix: user.password_hash ? user.password_hash.slice(0, 8) : null,
        passwordHashLength: user.password_hash ? user.password_hash.length : 0,
        passwordHash: user.password_hash,
        passwordIntento: password
      });

      // Verificar contraseña
      const isValidPassword = await AuthUtils.verifyPassword(password, user.password_hash);
      logger.info('Resultado comparación bcrypt', { email: user.email, resultado: isValidPassword });

      if (!isValidPassword) {
        logger.warn('Intento de login con contraseña incorrecta', {
          email,
          ip,
          hash: user.password_hash,
          passwordIntento: password
        });
        throw new Error('INVALID_CREDENTIALS');
      }

      // Crear nueva sesión
      const session = await SessionModel.createSession({
        userId: user.id_usuario,
        userAgent,
        ip,
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
      });

      // Obtener usuario con roles
      const userWithRoles = await UserModel.findWithRoles(user.id_usuario);

      // Generar access token
      const accessToken = AuthUtils.generateJWT(
        {
          userId: user.id_usuario,
          email: user.email,
          roles: userWithRoles.roles?.map(r => r.nombre) || [],
          role: 'authenticated' // Requerido por Supabase RLS
        },
        process.env.JWT_EXPIRES_IN || '15m'
      );

      logger.info('Login exitoso', {
        userId: user.id_usuario,
        email: user.email,
        sessionId: session.id_sesion
      });

      return {
        user: {
          id: user.id_usuario,
          email: user.email,
          nombre: user.nombre,
          activo: user.activo,
          roles: userWithRoles.roles || []
        },
        tokens: {
          accessToken,
          refreshToken: session.refresh_token,
          expiresIn: process.env.JWT_EXPIRES_IN || '15m'
        }
      };
    } catch (error) {
      logger.error('Error en login', error);
      throw error;
    }
  }

  /**
   * Renueva tokens de acceso
   * @param {string} refreshToken - Token de renovación
   * @returns {Promise<Object>} Nuevos tokens
   */
  static async refreshTokens(refreshToken) {
    try {
      // Validar sesión
      const session = await SessionModel.findByRefreshToken(refreshToken);

      if (!session) {
        throw new Error('INVALID_REFRESH_TOKEN');
      }

      const isValid = await SessionModel.isValidSession(refreshToken);

      if (!isValid) {
        throw new Error('SESSION_EXPIRED');
      }

      // Renovar sesión con nuevo refresh token
      const newSession = await SessionModel.renewSession(refreshToken);

      // Obtener usuario con roles actualizados
      const userWithRoles = await UserModel.findWithRoles(session.usuario_id);

      // Generar nuevo access token
      const newAccessToken = AuthUtils.generateJWT(
        {
          userId: userWithRoles.id_usuario,
          email: userWithRoles.email,
          roles: userWithRoles.roles?.map(r => r.nombre) || []
        },
        process.env.JWT_EXPIRES_IN || '15m'
      );

      // Actualizar última actividad
      await SessionModel.updateLastActivity(newSession.refresh_token);

      logger.info('Tokens renovados', {
        userId: userWithRoles.id_usuario,
        sessionId: newSession.id_sesion
      });

      return {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newSession.refresh_token,
          expiresIn: process.env.JWT_EXPIRES_IN || '15m'
        },
        user: {
          id: userWithRoles.id_usuario,
          email: userWithRoles.email,
          nombre: userWithRoles.nombre,
          roles: userWithRoles.roles || []
        }
      };
    } catch (error) {
      logger.error('Error al renovar tokens', error);
      throw error;
    }
  }

  /**
   * Cierra sesión del usuario
   * @param {string} refreshToken - Token de renovación a invalidar
   * @returns {Promise<boolean>} True si se cerró correctamente
   */
  static async logout(refreshToken) {
    try {
      if (!refreshToken) {
        return true; // Si no hay token, considerar logout exitoso
      }

      await SessionModel.invalidateByRefreshToken(refreshToken);

      logger.info('Logout exitoso');
      return true;
    } catch (error) {
      logger.error('Error en logout', error);
      throw error;
    }
  }

  /**
   * Cierra todas las sesiones de un usuario
   * @param {number} userId - ID del usuario
   * @param {number} exceptSessionId - ID de sesión a mantener (opcional)
   * @returns {Promise<number>} Número de sesiones cerradas
   */
  static async logoutAllSessions(userId, exceptSessionId = null) {
    try {
      const invalidatedCount = await SessionModel.invalidateAllUserSessions(userId, exceptSessionId);

      logger.info('Logout de todas las sesiones', {
        userId,
        invalidatedCount,
        exceptSessionId
      });

      return invalidatedCount;
    } catch (error) {
      logger.error('Error al cerrar todas las sesiones', error);
      throw error;
    }
  }

  /**
   * Cambia la contraseña del usuario
   * @param {number} userId - ID del usuario
   * @param {string} currentPassword - Contraseña actual
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<boolean>} True si se cambió correctamente
   */
  static async changePassword(userId, currentPassword, newPassword) {
    try {
      // Obtener usuario actual
      const user = await UserModel.findByEmail((await UserModel.findById(userId)).email);

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Verificar contraseña actual
      const isCurrentValid = await AuthUtils.verifyPassword(currentPassword, user.password_hash);

      if (!isCurrentValid) {
        throw new Error('INVALID_CURRENT_PASSWORD');
      }

      // Validar nueva contraseña
      const passwordValidation = AuthUtils.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        const error = new Error('PASSWORD_WEAK');
        error.details = passwordValidation.errors;
        throw error;
      }

      // Cambiar contraseña
      await UserModel.changePassword(userId, newPassword);

      // Invalidar todas las sesiones excepto la actual (implementar según necesidades)
      // await this.logoutAllSessions(userId);

      logger.info('Contraseña cambiada exitosamente', { userId });
      return true;
    } catch (error) {
      logger.error('Error al cambiar contraseña', error);
      throw error;
    }
  }

  /**
   * Verifica si un token de acceso es válido
   * @param {string} accessToken - Token de acceso
   * @returns {Promise<Object|null>} Usuario si es válido, null si no
   */
  static async verifyAccessToken(accessToken) {
    try {
      const decoded = AuthUtils.verifyJWT(accessToken);
      const user = await UserModel.findWithRoles(decoded.userId);

      if (!user || !user.activo || user.bloqueado) {
        return null;
      }

      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Limpia sesiones expiradas del sistema
   * @returns {Promise<number>} Número de sesiones limpiadas
   */
  static async cleanExpiredSessions() {
    try {
      const cleanedCount = await SessionModel.cleanExpiredSessions();

      if (cleanedCount > 0) {
        logger.info(`${cleanedCount} sesiones expiradas limpiadas automáticamente`);
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Error al limpiar sesiones expiradas', error);
      return 0;
    }
  }
}

module.exports = AuthService;