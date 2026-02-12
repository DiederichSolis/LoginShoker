const express = require('express');
const SessionController = require('../controllers/SessionController');
const { validateRequest } = require('../middleware/validation');
const { 
  authenticateToken,
  requireAdmin,
  requireActiveUser
} = require('../middleware/authMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
router.use(requireActiveUser);

// Rutas para el usuario autenticado
router.get('/', SessionController.getSessions);
router.get('/stats', SessionController.getSessionStats);

router.delete('/:sessionId',
  [
    require('express-validator').param('sessionId')
      .isUUID()
      .withMessage('ID de sesión inválido')
  ],
  validateRequest,
  SessionController.invalidateSession
);

router.delete('/all', SessionController.invalidateAllSessions);

// Rutas que requieren ser admin
router.delete('/cleanup',
  requireAdmin,
  SessionController.cleanupExpiredSessions
);

module.exports = router;