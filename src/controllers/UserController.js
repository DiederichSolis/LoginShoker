const { body, param, query } = require('express-validator');
const UserModel = require('../models/UserModel');
const RoleModel = require('../models/RoleModel');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Controlador de usuarios
 */
class UserController {
  /**
   * Validaciones para obtener usuarios
   */
  static getUsersValidation = [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('La página debe ser un número entero mayor a 0'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('El límite debe ser un número entre 1 y 100'),
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('La búsqueda no puede exceder 100 caracteres'),
    query('includeInactive')
      .optional()
      .isBoolean()
      .withMessage('includeInactive debe ser true o false')
  ];

  /**
   * Validaciones para actualizar usuario
   */
  static updateUserValidation = [
    param('userId')
      .isInt({ min: 1 })
      .withMessage('ID de usuario inválido'),
    body('nombre')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('activo')
      .optional()
      .isBoolean()
      .withMessage('activo debe ser true o false'),
    body('bloqueado')
      .optional()
      .isBoolean()
      .withMessage('bloqueado debe ser true o false')
  ];

  /**
   * Validaciones para asignar rol
   */
  static assignRoleValidation = [
    param('userId')
      .isInt({ min: 1 })
      .withMessage('ID de usuario inválido'),
    body('rolId')
      .isInt({ min: 1 })
      .withMessage('ID de rol inválido')
  ];

  /**
   * Obtiene lista de usuarios (solo admin)
   * GET /api/users
   */
  static getUsers = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search = '',
      includeInactive = false
    } = req.query;

    const result = await UserModel.getUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      includeInactive: includeInactive === 'true'
    });

    // Mapear id_usuario a id en cada usuario
    const mappedUsers = result.users.map(user => ({
      id: user.id_usuario,
      email: user.email,
      nombre: user.nombre,
      activo: user.activo,
      bloqueado: user.bloqueado,
      intentosFallidos: user.intentos_fallidos,
      fechaCreacion: user.fecha_creacion
    }));

    ApiResponse.success(res, {
      users: mappedUsers,
      pagination: result.pagination
    }, 'Usuarios obtenidos exitosamente');
  });

  /**
   * Obtiene un usuario específico
   * GET /api/users/:userId
   */
  static getUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await UserModel.findWithRoles(parseInt(userId));

    if (!user) {
      return ApiResponse.notFound(res, 'Usuario no encontrado', 'USER_NOT_FOUND');
    }

    // Mapear id_usuario a id
    const mappedUser = {
      id: user.id_usuario,
      email: user.email,
      nombre: user.nombre,
      activo: user.activo,
      bloqueado: user.bloqueado,
      intentosFallidos: user.intentos_fallidos,
      fechaCreacion: user.fecha_creacion,
      roles: user.roles?.map(r => ({
        id: r.id_rol,
        nombre: r.nombre,
        descripcion: r.descripcion
      })) || []
    };

    ApiResponse.success(res, { user: mappedUser }, 'Usuario obtenido exitosamente');
  });

  /**
   * Actualiza información de un usuario
   * PUT /api/users/:userId
   */
  static updateUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const updateData = req.body;

    // Verificar que el usuario existe
    const existingUser = await UserModel.findById(parseInt(userId));
    if (!existingUser) {
      return ApiResponse.notFound(res, 'Usuario no encontrado', 'USER_NOT_FOUND');
    }

    const updatedUser = await UserModel.updateUser(parseInt(userId), updateData);

    // Mapear respuesta
    const mappedUser = {
      id: updatedUser.id_usuario,
      email: updatedUser.email,
      nombre: updatedUser.nombre,
      activo: updatedUser.activo,
      bloqueado: updatedUser.bloqueado
    };

    ApiResponse.success(res, { user: mappedUser }, 'Usuario actualizado exitosamente');
  });

  /**
   * Desactiva un usuario (soft delete)
   * DELETE /api/users/:userId
   */
  static deactivateUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Verificar que el usuario existe
    const existingUser = await UserModel.findById(parseInt(userId));
    if (!existingUser) {
      return ApiResponse.notFound(res, 'Usuario no encontrado', 'USER_NOT_FOUND');
    }

    // No permitir desactivar el propio usuario si es admin
    if (parseInt(userId) === req.userId) {
      return ApiResponse.error(res, 'No puedes desactivar tu propia cuenta', 400, 'CANNOT_DEACTIVATE_SELF');
    }

    await UserModel.deactivateUser(parseInt(userId));

    ApiResponse.success(res, null, 'Usuario desactivado exitosamente');
  });

  /**
   * Asigna rol a usuario
   * POST /api/users/:userId/roles
   */
  static assignRole = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { rolId } = req.body;

    // Verificar que el usuario existe
    const user = await UserModel.findById(parseInt(userId));
    if (!user) {
      return ApiResponse.notFound(res, 'Usuario no encontrado', 'USER_NOT_FOUND');
    }

    // Verificar que el rol existe
    const role = await RoleModel.findById(rolId);
    if (!role) {
      return ApiResponse.notFound(res, 'Rol no encontrado', 'ROLE_NOT_FOUND');
    }

    try {
      await UserModel.assignRole(parseInt(userId), rolId);

      ApiResponse.success(res, null, `Rol ${role.nombre} asignado exitosamente`);
    } catch (error) {
      if (error.message === 'ROLE_ALREADY_ASSIGNED') {
        return ApiResponse.error(res, 'El usuario ya tiene este rol asignado', 409, 'ROLE_ALREADY_ASSIGNED');
      }
      throw error;
    }
  });

  /**
   * Remueve rol de usuario
   * DELETE /api/users/:userId/roles/:roleId
   */
  static removeRole = asyncHandler(async (req, res) => {
    const { userId, roleId } = req.params;

    // Verificar que el usuario existe
    const user = await UserModel.findById(parseInt(userId));
    if (!user) {
      return ApiResponse.notFound(res, 'Usuario no encontrado', 'USER_NOT_FOUND');
    }

    // Verificar que el rol existe
    const role = await RoleModel.findById(parseInt(roleId));
    if (!role) {
      return ApiResponse.notFound(res, 'Rol no encontrado', 'ROLE_NOT_FOUND');
    }

    await UserModel.removeRole(parseInt(userId), parseInt(roleId));

    ApiResponse.success(res, null, `Rol ${role.nombre} removido exitosamente`);
  });

  /**
   * Obtiene roles de un usuario específico
   * GET /api/users/:userId/roles
   */
  static getUserRoles = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Verificar que el usuario existe
    const user = await UserModel.findById(parseInt(userId));
    if (!user) {
      return ApiResponse.notFound(res, 'Usuario no encontrado', 'USER_NOT_FOUND');
    }

    const roles = await RoleModel.getUserRoles(parseInt(userId));

    // Mapear id_rol a id
    const mappedRoles = roles.map(role => ({
      id: role.id_rol,
      nombre: role.nombre,
      descripcion: role.descripcion
    }));

    ApiResponse.success(res, { roles: mappedRoles }, 'Roles del usuario obtenidos exitosamente');
  });

  /**
   * Obtiene el perfil del usuario autenticado
   * GET /api/users/profile
   */
  static getProfile = asyncHandler(async (req, res) => {
    const user = req.user;

    ApiResponse.success(res, {
      user: {
        id: user.id_usuario, // Mapear id_usuario a id
        email: user.email,
        nombre: user.nombre,
        activo: user.activo,
        roles: user.roles?.map(r => ({
          id: r.id_rol,
          nombre: r.nombre,
          descripcion: r.descripcion
        })) || [],
        fechaCreacion: user.fecha_creacion
      }
    }, 'Perfil obtenido exitosamente');
  });

  /**
   * Actualiza el perfil del usuario autenticado
   * PUT /api/users/profile
   */
  static updateProfile = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const { nombre } = req.body;

    // Solo permitir actualizar nombre en el perfil propio
    const updateData = { nombre };

    const updatedUser = await UserModel.updateUser(userId, updateData);

    ApiResponse.success(res, { user: updatedUser }, 'Perfil actualizado exitosamente');
  });

  /**
   * Obtiene todos los usuarios con sus roles (para admin)
   * GET /api/users/all
   */
  static getAllWithRoles = asyncHandler(async (req, res) => {
    const users = await UserModel.getAllWithRoles();

    // Mapear respuesta para el frontend
    const mappedUsers = users.map(user => ({
      id_usuario: user.id_usuario,
      email: user.email,
      nombre: user.nombre,
      activo: user.activo,
      bloqueado: user.bloqueado,
      intentos_fallidos: user.intentos_fallidos,
      fecha_creacion: user.fecha_creacion,
      roles: user.roles || [],
      rol_nombre: user.roles?.[0]?.nombre || 'Sin rol'
    }));

    ApiResponse.success(res, { users: mappedUsers }, 'Usuarios obtenidos exitosamente');
  });

  /**
   * Aprueba un usuario pendiente (activo=true, bloqueado=false)
   * PATCH /api/users/:userId/approve
   */
  static approveUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Verificar que el usuario existe
    const existingUser = await UserModel.findById(parseInt(userId));
    if (!existingUser) {
      return ApiResponse.notFound(res, 'Usuario no encontrado', 'USER_NOT_FOUND');
    }

    // Verificar que el usuario tiene rol 5 (colaborador)
    const userWithRoles = await UserModel.findWithRoles(parseInt(userId));
    const hasColaboradorRole = userWithRoles.roles?.some(r => r.id_rol === 5);

    if (!hasColaboradorRole) {
      return ApiResponse.error(res, 'El usuario no está pendiente de aprobación', 400, 'NOT_PENDING_APPROVAL');
    }

    // 1. Activar usuario
    await UserModel.updateUser(parseInt(userId), {
      activo: true,
      bloqueado: false
    });

    // 2. Remover rol 5 (colaborador)
    await UserModel.removeAllRoles(parseInt(userId));

    // 3. Asignar rol 2 (cliente)
    const clienteRoleId = 2;
    await UserModel.assignRole(parseInt(userId), clienteRoleId);

    logger.info('Usuario aprobado y rol cambiado', {
      userId: parseInt(userId),
      oldRole: 5,
      newRole: clienteRoleId
    });

    ApiResponse.success(res, null, 'Usuario aprobado exitosamente');
  });

  /**
   * Cambia el rol de un usuario (reemplaza el rol actual)
   * PATCH /api/users/:userId/role
   */
  static changeRole = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { roleId } = req.body;

    if (!roleId) {
      return ApiResponse.error(res, 'El roleId es requerido', 400, 'ROLE_ID_REQUIRED');
    }

    // Verificar que el usuario existe
    const user = await UserModel.findById(parseInt(userId));
    if (!user) {
      return ApiResponse.notFound(res, 'Usuario no encontrado', 'USER_NOT_FOUND');
    }

    // Verificar que el usuario no tiene rol 5 (colaborador pendiente)
    const userWithRoles = await UserModel.findWithRoles(parseInt(userId));
    const hasColaboradorRole = userWithRoles.roles?.some(r => r.id_rol === 5);

    if (hasColaboradorRole) {
      return ApiResponse.error(
        res,
        'No se puede cambiar el rol de un usuario pendiente de aprobación. Debe aprobarlo primero.',
        400,
        'USER_PENDING_APPROVAL'
      );
    }

    // Verificar que el rol existe
    const role = await RoleModel.findById(parseInt(roleId));
    if (!role) {
      return ApiResponse.notFound(res, 'Rol no encontrado', 'ROLE_NOT_FOUND');
    }

    // Remover todos los roles actuales y asignar el nuevo
    await UserModel.removeAllRoles(parseInt(userId));
    await UserModel.assignRole(parseInt(userId), parseInt(roleId));

    ApiResponse.success(res, null, `Rol cambiado a ${role.nombre} exitosamente`);
  });

  /**
   * Activa o desactiva un usuario
   * PATCH /api/users/:userId/toggle-active
   */
  static toggleActive = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { activo } = req.body;

    if (typeof activo !== 'boolean') {
      return ApiResponse.error(res, 'El campo activo debe ser true o false', 400, 'INVALID_ACTIVO');
    }

    // Verificar que el usuario existe
    const existingUser = await UserModel.findById(parseInt(userId));
    if (!existingUser) {
      return ApiResponse.notFound(res, 'Usuario no encontrado', 'USER_NOT_FOUND');
    }

    // No permitir desactivar el propio usuario si es admin
    if (parseInt(userId) === req.userId && !activo) {
      return ApiResponse.error(res, 'No puedes desactivar tu propia cuenta', 400, 'CANNOT_DEACTIVATE_SELF');
    }

    await UserModel.updateUser(parseInt(userId), { activo });

    const message = activo ? 'Usuario activado exitosamente' : 'Usuario desactivado exitosamente';
    ApiResponse.success(res, null, message);
  });

  /**
   * Elimina permanentemente un usuario
   * DELETE /api/users/:userId/permanent
   */
  static deleteUserPermanently = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Verificar que el usuario existe
    const existingUser = await UserModel.findById(parseInt(userId));
    if (!existingUser) {
      return ApiResponse.notFound(res, 'Usuario no encontrado', 'USER_NOT_FOUND');
    }

    // No permitir eliminar el propio usuario
    if (parseInt(userId) === req.userId) {
      return ApiResponse.error(res, 'No puedes eliminar tu propia cuenta', 400, 'CANNOT_DELETE_SELF');
    }

    try {
      await UserModel.deleteUser(parseInt(userId));
      ApiResponse.success(res, null, 'Usuario eliminado permanentemente');
    } catch (error) {
      // Si hay error de foreign key, informar al usuario
      if (error.code === '23503' || error.message?.includes('foreign key')) {
        return ApiResponse.error(
          res,
          'No se puede eliminar: el usuario tiene datos asociados (ventas, premios, etc.)',
          409,
          'USER_HAS_DEPENDENCIES'
        );
      }
      throw error;
    }
  });
}

module.exports = UserController;