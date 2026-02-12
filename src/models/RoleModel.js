const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Modelo para manejar operaciones de roles
 */
class RoleModel {
  /**
   * Crea un nuevo rol
   * @param {string} nombre - Nombre del rol
   * @param {string} descripcion - Descripción del rol (opcional)
   * @returns {Promise<Object>} Rol creado
   */
  static async createRole(nombre, descripcion = null) {
    try {
      const { data, error } = await supabaseAdmin
        .from('roles')
        .insert([{ 
          nombre: nombre.toLowerCase(),
          descripcion 
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Duplicate key
          throw new Error('ROLE_ALREADY_EXISTS');
        }
        throw error;
      }

      logger.info('Rol creado exitosamente', { roleId: data.id_rol, nombre });
      return data;
    } catch (error) {
      logger.error('Error al crear rol', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los roles
   * @returns {Promise<Array>} Lista de roles
   */
  static async getAllRoles() {
    try {
      const { data, error } = await supabaseAdmin
        .from('roles')
        .select('id_rol, nombre, descripcion, fecha_creacion')
        .order('id_rol');

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error al obtener roles', error);
      throw error;
    }
  }

  /**
   * Busca rol por ID
   * @param {number} roleId - ID del rol
   * @returns {Promise<Object|null>} Rol encontrado o null
   */
  static async findById(roleId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('roles')
        .select('id_rol, nombre, descripcion, fecha_creacion')
        .eq('id_rol', roleId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error al buscar rol por ID', error);
      throw error;
    }
  }

  /**
   * Busca rol por nombre
   * @param {string} nombre - Nombre del rol
   * @returns {Promise<Object|null>} Rol encontrado o null
   */
  static async findByName(nombre) {
    try {
      const { data, error } = await supabaseAdmin
        .from('roles')
        .select('id_rol, nombre, descripcion, fecha_creacion')
        .eq('nombre', nombre.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error al buscar rol por nombre', error);
      throw error;
    }
  }

  /**
   * Actualiza un rol
   * @param {number} roleId - ID del rol
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>} Rol actualizado
   */
  static async updateRole(roleId, updateData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('roles')
        .update(updateData)
        .eq('id_rol', roleId)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Duplicate key
          throw new Error('ROLE_ALREADY_EXISTS');
        }
        throw error;
      }

      logger.info('Rol actualizado', { roleId, updateData });
      return data;
    } catch (error) {
      logger.error('Error al actualizar rol', error);
      throw error;
    }
  }

  /**
   * Elimina un rol
   * @param {number} roleId - ID del rol
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  static async deleteRole(roleId) {
    try {
      // Primero verificar si el rol tiene usuarios asignados
      const { data: userRoles } = await supabaseAdmin
        .from('usuario_roles')
        .select('id_usuario')
        .eq('id_rol', roleId)
        .limit(1);

      if (userRoles && userRoles.length > 0) {
        throw new Error('ROLE_HAS_USERS');
      }

      const { error } = await supabaseAdmin
        .from('roles')
        .delete()
        .eq('id_rol', roleId);

      if (error) {
        throw error;
      }

      logger.info('Rol eliminado', { roleId });
      return true;
    } catch (error) {
      logger.error('Error al eliminar rol', error);
      throw error;
    }
  }

  /**
   * Obtiene usuarios con un rol específico
   * @param {number} roleId - ID del rol
   * @returns {Promise<Array>} Lista de usuarios con el rol
   */
  static async getUsersByRole(roleId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('usuario_roles')
        .select(`
          usuarios(
            id_usuario, email, nombre, activo, fecha_creacion
          )
        `)
        .eq('id_rol', roleId);

      if (error) {
        throw error;
      }

      return data?.map(item => item.usuarios) || [];
    } catch (error) {
      logger.error('Error al obtener usuarios por rol', error);
      throw error;
    }
  }

  /**
   * Obtiene roles de un usuario específico
   * @param {number} userId - ID del usuario
   * @returns {Promise<Array>} Lista de roles del usuario
   */
  static async getUserRoles(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('usuario_roles')
        .select(`
          roles(
            id_rol, nombre, descripcion
          )
        `)
        .eq('id_usuario', userId);

      if (error) {
        throw error;
      }

      return data?.map(item => item.roles) || [];
    } catch (error) {
      logger.error('Error al obtener roles de usuario', error);
      throw error;
    }
  }

  /**
   * Verifica si un usuario tiene un rol específico
   * @param {number} userId - ID del usuario
   * @param {string} roleName - Nombre del rol
   * @returns {Promise<boolean>} True si el usuario tiene el rol
   */
  static async userHasRole(userId, roleName) {
    try {
      const { data, error } = await supabaseAdmin
        .from('usuario_roles')
        .select(`
          roles!inner(nombre)
        `)
        .eq('id_usuario', userId)
        .eq('roles.nombre', roleName.toLowerCase())
        .limit(1);

      if (error) {
        throw error;
      }

      return data && data.length > 0;
    } catch (error) {
      logger.error('Error al verificar rol de usuario', error);
      return false;
    }
  }

  /**
   * Verifica si un usuario tiene alguno de los roles especificados
   * @param {number} userId - ID del usuario
   * @param {Array<string>} roleNames - Array de nombres de roles
   * @returns {Promise<boolean>} True si el usuario tiene alguno de los roles
   */
  static async userHasAnyRole(userId, roleNames) {
    try {
      const lowerRoleNames = roleNames.map(name => name.toLowerCase());
      
      const { data, error } = await supabaseAdmin
        .from('usuario_roles')
        .select(`
          roles!inner(nombre)
        `)
        .eq('id_usuario', userId)
        .in('roles.nombre', lowerRoleNames)
        .limit(1);

      if (error) {
        throw error;
      }

      return data && data.length > 0;
    } catch (error) {
      logger.error('Error al verificar roles múltiples de usuario', error);
      return false;
    }
  }

  /**
   * Inicializa roles por defecto del sistema
   * @returns {Promise<Array>} Roles creados
   */
  static async initializeDefaultRoles() {
    try {
      const defaultRoles = ['admin', 'empleado', 'cliente'];
      const createdRoles = [];

      for (const roleName of defaultRoles) {
        try {
          // Intentar crear el rol, si ya existe no hacer nada
          const existingRole = await this.findByName(roleName);
          
          if (!existingRole) {
            const newRole = await this.createRole(roleName);
            createdRoles.push(newRole);
          }
        } catch (error) {
          if (!error.message.includes('ROLE_ALREADY_EXISTS')) {
            throw error;
          }
        }
      }

      if (createdRoles.length > 0) {
        logger.info('Roles por defecto inicializados', { 
          createdRoles: createdRoles.map(r => r.nombre) 
        });
      }

      return createdRoles;
    } catch (error) {
      logger.error('Error al inicializar roles por defecto', error);
      throw error;
    }
  }
}

module.exports = RoleModel;