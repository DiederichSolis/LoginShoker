const { supabaseAdmin } = require('../config/supabase');
const AuthUtils = require('../utils/authUtils');
const logger = require('../utils/logger');

/**
 * Modelo para manejar operaciones de sesiones
 */
class SessionModel {
  /**
   * Crea una nueva sesión
   * @param {Object} sessionData - Datos de la sesión
   * @returns {Promise<Object>} Sesión creada
   */
  static async createSession({ userId, userAgent, ip, expiresIn = '7d' }) {
    try {
      const refreshToken = AuthUtils.generateRefreshToken();
      const expirationDate = AuthUtils.getExpirationDate(expiresIn);
      const parsedUserAgent = AuthUtils.parseUserAgent(userAgent);

      const { data, error } = await supabaseAdmin
        .from('sesiones')
        .insert([{
          usuario_id: userId,
          refresh_token: refreshToken,
          user_agent: parsedUserAgent,
          ip,
          fecha_expiracion: expirationDate.toISOString(),
          activo: true
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Nueva sesión creada', { 
        sessionId: data.id_sesion, 
        userId, 
        userAgent: parsedUserAgent 
      });
      
      return data;
    } catch (error) {
      logger.error('Error al crear sesión', error);
      throw error;
    }
  }

  /**
   * Busca sesión por refresh token
   * @param {string} refreshToken - Token de renovación
   * @returns {Promise<Object|null>} Sesión encontrada o null
   */
  static async findByRefreshToken(refreshToken) {
    try {
      const { data, error } = await supabaseAdmin
        .from('sesiones')
        .select(`
          *,
          usuarios(
            id_usuario, email, nombre, activo, bloqueado
          )
        `)
        .eq('refresh_token', refreshToken)
        .eq('activo', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error al buscar sesión por refresh token', error);
      throw error;
    }
  }

  /**
   * Obtiene sesiones activas de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Array>} Lista de sesiones activas
   */
  static async getActiveSessions(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('sesiones')
        .select('id_sesion, user_agent, ip, fecha_creacion, fecha_expiracion')
        .eq('usuario_id', userId)
        .eq('activo', true)
        .gt('fecha_expiracion', new Date().toISOString())
        .order('fecha_creacion', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error al obtener sesiones activas', error);
      throw error;
    }
  }

  /**
   * Invalida una sesión específica
   * @param {number} sessionId - ID de la sesión
   * @param {number} userId - ID del usuario (para verificación)
   * @returns {Promise<boolean>} True si se invalidó correctamente
   */
  static async invalidateSession(sessionId, userId = null) {
    try {
      let query = supabaseAdmin
        .from('sesiones')
        .update({ activo: false })
        .eq('id_sesion', sessionId);

      if (userId) {
        query = query.eq('usuario_id', userId);
      }

      const { error } = await query;

      if (error) {
        throw error;
      }

      logger.info('Sesión invalidada', { sessionId, userId });
      return true;
    } catch (error) {
      logger.error('Error al invalidar sesión', error);
      throw error;
    }
  }

  /**
   * Invalida todas las sesiones de un usuario
   * @param {number} userId - ID del usuario
   * @param {number} exceptSessionId - ID de sesión a mantener activa (opcional)
   * @returns {Promise<number>} Número de sesiones invalidadas
   */
  static async invalidateAllUserSessions(userId, exceptSessionId = null) {
    try {
      let query = supabaseAdmin
        .from('sesiones')
        .update({ activo: false })
        .eq('usuario_id', userId)
        .eq('activo', true);

      if (exceptSessionId) {
        query = query.neq('id_sesion', exceptSessionId);
      }

      const { data, error } = await query.select();

      if (error) {
        throw error;
      }

      const invalidatedCount = data ? data.length : 0;
      
      logger.info('Sesiones de usuario invalidadas', { 
        userId, 
        invalidatedCount,
        exceptSessionId 
      });
      
      return invalidatedCount;
    } catch (error) {
      logger.error('Error al invalidar sesiones de usuario', error);
      throw error;
    }
  }

  /**
   * Invalida sesión por refresh token
   * @param {string} refreshToken - Token de renovación
   * @returns {Promise<boolean>} True si se invalidó correctamente
   */
  static async invalidateByRefreshToken(refreshToken) {
    try {
      const { error } = await supabaseAdmin
        .from('sesiones')
        .update({ activo: false })
        .eq('refresh_token', refreshToken);

      if (error) {
        throw error;
      }

      logger.info('Sesión invalidada por refresh token');
      return true;
    } catch (error) {
      logger.error('Error al invalidar sesión por refresh token', error);
      throw error;
    }
  }

  /**
   * Verifica si una sesión es válida
   * @param {string} refreshToken - Token de renovación
   * @returns {Promise<boolean>} True si la sesión es válida
   */
  static async isValidSession(refreshToken) {
    try {
      const session = await this.findByRefreshToken(refreshToken);
      
      if (!session) {
        return false;
      }

      // Verificar expiración
      const now = new Date();
      const expiration = new Date(session.fecha_expiracion);
      
      if (now > expiration) {
        // Invalidar sesión expirada
        await this.invalidateSession(session.id_sesion);
        return false;
      }

      // Verificar que el usuario esté activo y no bloqueado
      if (!session.usuarios.activo || session.usuarios.bloqueado) {
        await this.invalidateSession(session.id_sesion);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error al verificar validez de sesión', error);
      return false;
    }
  }

  /**
   * Actualiza la última actividad de una sesión
   * @param {string} refreshToken - Token de renovación
   * @returns {Promise<boolean>} True si se actualizó correctamente
   */
  static async updateLastActivity(refreshToken) {
    try {
      const { error } = await supabaseAdmin
        .from('sesiones')
        .update({ 
          fecha_creacion: new Date().toISOString() // Reutilizamos este campo como "last activity"
        })
        .eq('refresh_token', refreshToken)
        .eq('activo', true);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      logger.error('Error al actualizar última actividad', error);
      return false;
    }
  }

  /**
   * Limpia sesiones expiradas
   * @returns {Promise<number>} Número de sesiones limpiadas
   */
  static async cleanExpiredSessions() {
    try {
      const { data, error } = await supabaseAdmin
        .from('sesiones')
        .update({ activo: false })
        .lt('fecha_expiracion', new Date().toISOString())
        .eq('activo', true)
        .select();

      if (error) {
        throw error;
      }

      const cleanedCount = data ? data.length : 0;
      
      if (cleanedCount > 0) {
        logger.info(`${cleanedCount} sesiones expiradas limpiadas`);
      }
      
      return cleanedCount;
    } catch (error) {
      logger.error('Error al limpiar sesiones expiradas', error);
      throw error;
    }
  }

  /**
   * Renueva una sesión extendiendo su expiración
   * @param {string} refreshToken - Token de renovación actual
   * @param {string} expiresIn - Nueva duración de la sesión
   * @returns {Promise<Object>} Nueva información de la sesión
   */
  static async renewSession(refreshToken, expiresIn = '7d') {
    try {
      const newRefreshToken = AuthUtils.generateRefreshToken();
      const newExpirationDate = AuthUtils.getExpirationDate(expiresIn);

      const { data, error } = await supabaseAdmin
        .from('sesiones')
        .update({
          refresh_token: newRefreshToken,
          fecha_expiracion: newExpirationDate.toISOString(),
          fecha_creacion: new Date().toISOString()
        })
        .eq('refresh_token', refreshToken)
        .eq('activo', true)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Sesión renovada', { sessionId: data.id_sesion });
      return data;
    } catch (error) {
      logger.error('Error al renovar sesión', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de sesiones de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Estadísticas de sesiones
   */
  static async getUserSessionStats(userId) {
    try {
      const { data: activeSessions, error: activeError } = await supabaseAdmin
        .from('sesiones')
        .select('id_sesion')
        .eq('usuario_id', userId)
        .eq('activo', true)
        .gt('fecha_expiracion', new Date().toISOString());

      if (activeError) throw activeError;

      const { data: totalSessions, error: totalError } = await supabaseAdmin
        .from('sesiones')
        .select('id_sesion')
        .eq('usuario_id', userId);

      if (totalError) throw totalError;

      return {
        activeSessions: activeSessions?.length || 0,
        totalSessions: totalSessions?.length || 0
      };
    } catch (error) {
      logger.error('Error al obtener estadísticas de sesión', error);
      throw error;
    }
  }
}

module.exports = SessionModel;