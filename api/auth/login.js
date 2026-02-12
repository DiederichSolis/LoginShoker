const { body } = require('express-validator');
const AuthService = require('../../src/services/AuthService');
const logger = require('../../src/utils/logger');

// Helper para manejar CORS
function handleCORS(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}

/**
 * Endpoint de login
 * POST /api/auth/login
 */
module.exports = async (req, res) => {
  handleCORS(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Validaciones
    const validations = [
      body('email')
        .isEmail()
        .withMessage('Email inválido'),
      body('password')
        .notEmpty()
        .withMessage('Contraseña requerida')
    ];

    // Ejecutar validaciones
    for (let validation of validations) {
      const result = await validation.run(req);
      if (!result.isEmpty()) {
        const errors = result.array().map(error => ({
          field: error.path || error.param,
          message: error.msg,
          value: error.value
        }));
        
        return res.status(400).json({
          success: false,
          message: 'Errores de validación',
          code: 'VALIDATION_ERROR',
          errors,
          timestamp: new Date().toISOString()
        });
      }
    }

  const { email, password } = req.body;
  logger.info('Email recibido en req.body', { emailOriginal: email });

    const result = await AuthService.login(
      { email, password },
      { 
        userAgent: req.headers['user-agent'] || 'Unknown',
        ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown'
      }
    );

    res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error en login', error);
    
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS',
        timestamp: new Date().toISOString()
      });
    }

    if (error.message === 'ACCOUNT_DISABLED') {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada',
        code: 'ACCOUNT_DISABLED',
        timestamp: new Date().toISOString()
      });
    }

    if (error.message === 'ACCOUNT_LOCKED') {
      return res.status(401).json({
        success: false,
        message: 'Cuenta bloqueada',
        code: 'ACCOUNT_LOCKED',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' 
        ? 'Error interno del servidor' 
        : error.message,
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};