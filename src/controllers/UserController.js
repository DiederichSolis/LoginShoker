const { body, param, query } = require('express-validator');
const UserModel = require('../models/UserModel');
const RoleModel = require('../models/RoleModel');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

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
}

module.exports = UserController;