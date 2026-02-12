const express = require('express');
const UserController = require('../controllers/UserController');
const { validateRequest } = require('../middleware/validation');
const { 
  authenticateToken,
  requireAdmin,
  requireOwnershipOrAdmin,
  requireActiveUser
} = require('../middleware/authMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
router.use(requireActiveUser);

// Ruta para obtener/actualizar perfil propio
router.get('/profile', UserController.getProfile);
router.put('/profile',
  [
    require('express-validator').body('nombre')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('El nombre debe tener entre 2 y 100 caracteres')
  ],
  validateRequest,
  UserController.updateProfile
);

// Rutas que requieren ser admin
router.get('/',
  requireAdmin,
  UserController.getUsersValidation,
  validateRequest,
  UserController.getUsers
);

// Rutas que requieren ser admin o dueño del recurso
router.get('/:userId',
  requireOwnershipOrAdmin(),
  UserController.getUser
);

router.put('/:userId',
  requireOwnershipOrAdmin(),
  UserController.updateUserValidation,
  validateRequest,
  UserController.updateUser
);

router.get('/:userId/roles',
  requireOwnershipOrAdmin(),
  UserController.getUserRoles
);

// Rutas que requieren ser admin
router.delete('/:userId',
  requireAdmin,
  UserController.deactivateUser
);

router.post('/:userId/roles',
  requireAdmin,
  UserController.assignRoleValidation,
  validateRequest,
  UserController.assignRole
);

router.delete('/:userId/roles/:roleId',
  requireAdmin,
  [
    require('express-validator').param('userId')
      .isUUID()
      .withMessage('ID de usuario inválido'),
    require('express-validator').param('roleId')
      .isInt({ min: 1 })
      .withMessage('ID de rol inválido')
  ],
  validateRequest,
  UserController.removeRole
);

module.exports = router;