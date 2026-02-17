const { supabaseAdmin } = require('../config/supabase');
const AuthUtils = require('../utils/authUtils');
const logger = require('../utils/logger');

/**
 * Modelo para manejar operaciones de usuarios
 */
class UserModel {
  /**
   * Crea un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} Usuario creado
   */
  static async createUser({ email, password, nombre = null, activo = false, bloqueado = false }) {
    try {
      const passwordHash = await AuthUtils.hashPassword(password);

      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .insert([{
          email: email.toLowerCase(),
          password_hash: passwordHash,
          nombre,
          activo,
          bloqueado,
          intentos_fallidos: 0
        }])
        .select('id_usuario, email, nombre, activo, bloqueado, fecha_creacion')
        .single();

      if (error) {
        if (error.code === '23505') { // Duplicate key
          throw new Error('EMAIL_ALREADY_EXISTS');
        }
        throw error;
      }

      logger.info('Usuario creado exitosamente', { userId: data.id_usuario, email });
      return data;
    } catch (error) {
      logger.error('Error al crear usuario', error);
      throw error;
    }
  }

  /**
   * Busca usuario por email
   * @param {string} email - Email del usuario
   * @returns {Promise<Object|null>} Usuario encontrado o null
   */
  static async findByEmail(email) {
    try {
      const emailToFind = String(email || '').toLowerCase();
      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .eq('email', emailToFind)
        .single();

      // Log raw response for debugging
      logger.info('Supabase query result for findByEmail', {
        emailQuery: emailToFind,
        dataFound: !!data,
        data: data ? { id_usuario: data.id_usuario, email: data.email } : null,
        error: error ? { message: error.message || error, code: error.code } : null
      });

      // PGRST116 significa que no se encontró el usuario, retornar null
      if (error && error.code === 'PGRST116') {
        logger.info('Usuario no encontrado en BD', { email: emailToFind });
        return null;
      }

      // Si hay otro tipo de error, lanzarlo
      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error al buscar usuario por email', error);
      throw error;
    }
  }

  /**
   * Busca usuario por ID
   * @param {number} userId - ID del usuario (integer)
   * @returns {Promise<Object|null>} Usuario encontrado o null
   */
  static async findById(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select('id_usuario, email, nombre, activo, bloqueado, intentos_fallidos, fecha_bloqueo, fecha_creacion')
        .eq('id_usuario', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error al buscar usuario por ID', error);
      throw error;
    }
  }

  /**
   * Obtiene usuario con sus roles
   * @param {number} userId - ID del usuario (integer)
   * @returns {Promise<Object|null>} Usuario con roles
   */
  static async findWithRoles(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select(`
          id_usuario, email, nombre, activo, bloqueado, intentos_fallidos, fecha_creacion,
          usuario_roles(
            rol_id,
            roles(
              id_rol, nombre, descripcion
            )
          )
        `)
        .eq('id_usuario', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Transformar la estructura de roles
        data.roles = data.usuario_roles?.map(ur => ur.roles) || [];
        delete data.usuario_roles;
      }

      return data;
    } catch (error) {
      logger.error('Error al buscar usuario con roles', error);
      throw error;
    }
  }

  /**
   * Actualiza información del usuario
   * @param {number} userId - ID del usuario (integer)
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>} Usuario actualizado
   */
  static async updateUser(userId, updateData) {
    try {
      const allowedFields = ['nombre', 'activo', 'bloqueado', 'intentos_fallidos', 'fecha_bloqueo'];
      const filteredData = {};

      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredData[key] = updateData[key];
        }
      });

      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .update(filteredData)
        .eq('id_usuario', userId)
        .select('id_usuario, email, nombre, activo, bloqueado, intentos_fallidos, fecha_creacion')
        .single();

      if (error) {
        throw error;
      }

      logger.info('Usuario actualizado', { userId, updatedFields: Object.keys(filteredData) });
      return data;
    } catch (error) {
      logger.error('Error al actualizar usuario', error);
      throw error;
    }
  }

  /**
   * Cambia contraseña del usuario
   * @param {number} userId - ID del usuario (integer)
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<boolean>} True si se cambió correctamente
   */
  static async changePassword(userId, newPassword) {
    try {
      const passwordHash = await AuthUtils.hashPassword(newPassword);

      const { error } = await supabaseAdmin
        .from('usuarios')
        .update({ password_hash: passwordHash })
        .eq('id_usuario', userId);

      if (error) {
        throw error;
      }

      logger.info('Contraseña cambiada exitosamente', { userId });
      return true;
    } catch (error) {
      logger.error('Error al cambiar contraseña', error);
      throw error;
    }
  }

  /**
   * Asigna rol a usuario
   * @param {number} userId - ID del usuario
   * @param {number} rolId - ID del rol
   * @returns {Promise<Object>} Relación usuario-rol creada
   */
  static async assignRole(userId, rolId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('usuario_roles')
        .insert([{
          usuario_id: userId,
          rol_id: rolId
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Duplicate key
          throw new Error('ROLE_ALREADY_ASSIGNED');
        }
        throw error;
      }

      logger.info('Rol asignado a usuario', { userId, rolId });
      return data;
    } catch (error) {
      logger.error('Error al asignar rol', error);
      throw error;
    }
  }

  /**
   * Remueve rol de usuario
   * @param {number} userId - ID del usuario
   * @param {number} rolId - ID del rol
   * @returns {Promise<boolean>} True si se removió correctamente
   */
  static async removeRole(userId, rolId) {
    try {
      const { error } = await supabaseAdmin
        .from('usuario_roles')
        .delete()
        .eq('usuario_id', userId)
        .eq('rol_id', rolId);

      if (error) {
        throw error;
      }

      logger.info('Rol removido de usuario', { userId, rolId });
      return true;
    } catch (error) {
      logger.error('Error al remover rol', error);
      throw error;
    }
  }

  /**
   * Obtiene lista de usuarios con paginación
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Object>} Lista de usuarios con metadata
   */
  static async getUsers({ page = 1, limit = 10, search = '', includeInactive = false } = {}) {
    try {
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('usuarios')
        .select('id_usuario, email, nombre, activo, bloqueado, intentos_fallidos, fecha_creacion', { count: 'exact' });

      if (!includeInactive) {
        query = query.eq('activo', true);
      }

      if (search) {
        query = query.or(`email.ilike.%${search}%,nombre.ilike.%${search}%`);
      }

      query = query
        .order('fecha_creacion', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        users: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      };
    } catch (error) {
      logger.error('Error al obtener usuarios', error);
      throw error;
    }
  }

  /**
   * Elimina usuario (soft delete - marca como inactivo)
   * @param {number} userId - ID del usuario
   * @returns {Promise<boolean>} True si se desactivó correctamente
   */
  static async deactivateUser(userId) {
    try {
      const { error } = await supabaseAdmin
        .from('usuarios')
        .update({ activo: false })
        .eq('id_usuario', userId);

      if (error) {
        throw error;
      }

      logger.info('Usuario desactivado', { userId });
      return true;
    } catch (error) {
      logger.error('Error al desactivar usuario', error);
      throw error;
    }
  }
  /**
   * Obtiene todos los usuarios con sus roles
   * @returns {Promise<Array>} Lista de usuarios con roles
   */
  static async getAllWithRoles() {
    try {
      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select(`
          id_usuario, email, nombre, activo, bloqueado, intentos_fallidos, fecha_creacion,
          usuario_roles(
            rol_id,
            roles(
              id_rol, nombre, descripcion
            )
          )
        `)
        .order('id_usuario');

      if (error) {
        throw error;
      }

      // Transformar la estructura de roles para cada usuario
      const users = (data || []).map(user => ({
        ...user,
        roles: user.usuario_roles?.map(ur => ur.roles) || [],
        usuario_roles: undefined // Eliminar campo temporal
      }));

      return users;
    } catch (error) {
      logger.error('Error al obtener usuarios con roles', error);
      throw error;
    }
  }

  /**
   * Remueve todos los roles de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<boolean>} True si se removieron correctamente
   */
  static async removeAllRoles(userId) {
    try {
      const { error } = await supabaseAdmin
        .from('usuario_roles')
        .delete()
        .eq('usuario_id', userId);

      if (error) {
        throw error;
      }

      logger.info('Todos los roles removidos del usuario', { userId });
      return true;
    } catch (error) {
      logger.error('Error al remover todos los roles', error);
      throw error;
    }
  }

  /**
   * Elimina permanentemente un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  static async deleteUser(userId) {
    try {
      // Primero eliminar roles asociados
      await this.removeAllRoles(userId);

      // Luego eliminar el usuario
      const { error } = await supabaseAdmin
        .from('usuarios')
        .delete()
        .eq('id_usuario', userId);

      if (error) {
        throw error;
      }

      logger.info('Usuario eliminado permanentemente', { userId });
      return true;
    } catch (error) {
      logger.error('Error al eliminar usuario', error);
      throw error;
    }
  }
}

module.exports = UserModel;