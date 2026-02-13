const { body, validationResult } = require('express-validator');
const AuthService = require('../../src/services/AuthService');
const AuthUtils = require('../../src/utils/authUtils');
const ApiResponse = require('../../src/utils/apiResponse');
const logger = require('../../src/utils/logger');

// Helper para manejar CORS
function handleCORS(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}

// Helper para validación
function validateRequest(validations) {
  return async (req, res) => {
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
    return null;
  };
}

/**
 * Endpoint de registro
 * POST /api/auth/register
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
        .normalizeEmail()
        .withMessage('Email inválido'),
      body('password')
        .isLength({ min: 8 })
        .withMessage('La contraseña debe tener al menos 8 caracteres'),
      body('nombre')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres')
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

    const { email, password, nombre } = req.body;

    const result = await AuthService.register(
      { email, password, nombre },
      {
        userAgent: req.headers['user-agent'] || 'Unknown',
        ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown'
      }
    );

    res.status(201).json({
      success: true,
      message: 'Solicitud de acceso enviada. Tu cuenta está pendiente de aprobación por un administrador.',
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error en registro', error);

    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({
        success: false,
        message: 'El email ya está registrado',
        code: 'EMAIL_ALREADY_EXISTS',
        timestamp: new Date().toISOString()
      });
    }

    if (error.message === 'EMAIL_INVALID') {
      return res.status(400).json({
        success: false,
        message: 'Formato de email inválido',
        code: 'EMAIL_INVALID',
        timestamp: new Date().toISOString()
      });
    }

    if (error.message === 'PASSWORD_WEAK') {
      return res.status(400).json({
        success: false,
        message: 'La contraseña no cumple los requisitos',
        code: 'VALIDATION_ERROR',
        errors: error.details,
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