const express = require('express');
const AuthController = require('../controllers/AuthController');
const { validateRequest } = require('../middleware/validation');
const { 
  authenticateToken, 
  validateRefreshToken, 
  requireActiveUser 
} = require('../middleware/authMiddleware');

const router = express.Router();

// Rutas públicas
router.post('/register', 
  AuthController.registerValidation,
  validateRequest,
  AuthController.register
);

router.post('/login',
  AuthController.loginValidation,
  validateRequest,
  AuthController.login
);

router.post('/refresh',
  AuthController.refreshValidation,
  validateRequest,
  validateRefreshToken,
  AuthController.refresh
);

// Logout puede ser llamado sin autenticación válida
router.post('/logout', AuthController.logout);

// Rutas protegidas
router.use(authenticateToken);
router.use(requireActiveUser);

router.post('/logout-all', AuthController.logoutAll);

router.post('/change-password',
  AuthController.changePasswordValidation,
  validateRequest,
  AuthController.changePassword
);

router.get('/me', AuthController.getProfile);

router.post('/verify', AuthController.verifyToken);

router.get('/sessions', AuthController.getSessions);

router.delete('/sessions/:sessionId', AuthController.invalidateSession);

module.exports = router;