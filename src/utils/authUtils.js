const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Utilidades para autenticación y seguridad
 */
class AuthUtils {
  /**
   * Genera hash de contraseña usando bcrypt
   * @param {string} password - Contraseña en texto plano
   * @returns {Promise<string>} Hash de la contraseña
   */
  static async hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verifica contraseña contra hash
   * @param {string} password - Contraseña en texto plano
   * @param {string} hash - Hash almacenado
   * @returns {Promise<boolean>} True si coincide
   */
  static async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Genera JWT token
   * @param {Object} payload - Datos a incluir en el token
   * @param {string} expiresIn - Tiempo de expiración
   * @returns {string} JWT token
   */
  static generateJWT(payload, expiresIn = process.env.JWT_EXPIRES_IN || '15m') {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
  }

  /**
   * Verifica JWT token
   * @param {string} token - Token a verificar
   * @returns {Object} Payload decodificado
   */
  static verifyJWT(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  /**
   * Genera refresh token seguro
   * @returns {string} Refresh token
   */
  static generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Genera UUID
   * @returns {string} UUID v4
   */
  static generateUUID() {
    return uuidv4();
  }

  /**
   * Calcula fecha de expiración
   * @param {string} duration - Duración (ej: '7d', '1h', '30m')
   * @returns {Date} Fecha de expiración
   */
  static getExpirationDate(duration = '7d') {
    const now = new Date();
    const matches = duration.match(/^(\d+)([dhm])$/);
    
    if (!matches) {
      throw new Error('Formato de duración inválido. Use: 7d, 24h, 30m');
    }

    const [, amount, unit] = matches;
    const value = parseInt(amount);

    switch (unit) {
      case 'd':
        now.setDate(now.getDate() + value);
        break;
      case 'h':
        now.setHours(now.getHours() + value);
        break;
      case 'm':
        now.setMinutes(now.getMinutes() + value);
        break;
    }

    return now;
  }

  /**
   * Extrae información del User-Agent
   * @param {string} userAgent - User-Agent header
   * @returns {string} Información simplificada del dispositivo
   */
  static parseUserAgent(userAgent) {
    if (!userAgent) return 'Desconocido';
    
    // Detectar navegador principal
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    
    // Detectar móvil
    if (userAgent.includes('Mobile')) return 'Móvil';
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Android')) return 'Android';
    
    return 'Navegador';
  }

  /**
   * Obtiene IP real del request
   * @param {Object} req - Request object
   * @returns {string} Dirección IP
   */
  static getRealIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip || 
           'unknown';
  }

  /**
   * Valida formato de email
   * @param {string} email - Email a validar
   * @returns {boolean} True si es válido
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida fortaleza de contraseña
   * @param {string} password - Contraseña a validar
   * @returns {Object} Resultado de validación
   */
  static validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors = [];
    
    if (password.length < minLength) {
      errors.push(`Debe tener al menos ${minLength} caracteres`);
    }
    if (!hasUpperCase) {
      errors.push('Debe tener al menos una letra mayúscula');
    }
    if (!hasLowerCase) {
      errors.push('Debe tener al menos una letra minúscula');
    }
    if (!hasNumbers) {
      errors.push('Debe tener al menos un número');
    }
    if (!hasSpecialChar) {
      errors.push('Debe tener al menos un carácter especial');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = AuthUtils;