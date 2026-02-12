/**
 * Cliente JavaScript para la API de LoginShoker
 * Funciona tanto con desarrollo local como con Vercel
 * Úsalo en tu frontend para interactuar con la API
 */
class LoginShokerAPI {
  constructor(baseURL = null) {
    // Auto-detectar URL base
    if (!baseURL) {
      if (typeof window !== 'undefined') {
        // En el navegador
        baseURL = window.location.hostname === 'localhost' 
          ? 'http://localhost:3000/api'  // Desarrollo local
          : '/api';  // Producción (Vercel)
      } else {
        // En Node.js (testing)
        baseURL = 'http://localhost:3000/api';
      }
    }
    
    this.baseURL = baseURL;
    this.accessToken = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    this.refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem('refreshToken') : null;
  }

  /**
   * Realiza petición HTTP con manejo automático de tokens
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Agregar token de acceso si está disponible
    if (this.accessToken && !options.skipAuth) {
      config.headers.Authorization = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      // Si el token expiró, intentar renovarlo
      if (response.status === 401 && data.code === 'TOKEN_EXPIRED' && this.refreshToken) {
        const refreshed = await this.refreshTokens();
        if (refreshed) {
          // Reintentar la petición original con el nuevo token
          config.headers.Authorization = `Bearer ${this.accessToken}`;
          const retryResponse = await fetch(url, config);
          return await retryResponse.json();
        }
      }

      return { ...data, status: response.status, ok: response.ok };
    } catch (error) {
      throw new Error(`Error de red: ${error.message}`);
    }
  }

  /**
   * Registra un nuevo usuario
   */
  async register(email, password, nombre = null) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, nombre }),
      skipAuth: true
    });

    if (response.ok) {
      this.setTokens(response.data.tokens);
      return response.data;
    }

    throw new Error(response.message || 'Error en registro');
  }

  /**
   * Inicia sesión
   */
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true
    });

    if (response.ok) {
      this.setTokens(response.data.tokens);
      return response.data;
    }

    throw new Error(response.message || 'Error en login');
  }

  /**
   * Renueva los tokens
   */
  async refreshTokens() {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await this.request('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken }),
        skipAuth: true
      });

      if (response.ok) {
        this.setTokens(response.data.tokens);
        return true;
      }

      return false;
    } catch (error) {
      this.clearTokens();
      return false;
    }
  }

  /**
   * Cierra sesión
   */
  async logout() {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken }),
        skipAuth: true
      });
    } catch (error) {
      // Continuar con el logout local aunque falle la petición
    } finally {
      this.clearTokens();
    }
  }

  /**
   * Obtiene el perfil del usuario actual
   */
  async getProfile() {
    const response = await this.request('/auth/me');
    
    if (response.ok) {
      return response.data;
    }

    throw new Error(response.message || 'Error obteniendo perfil');
  }

  /**
   * Cambia la contraseña
   */
  async changePassword(currentPassword, newPassword) {
    const response = await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });

    if (response.ok) {
      return response.data;
    }

    throw new Error(response.message || 'Error cambiando contraseña');
  }

  /**
   * Obtiene las sesiones activas
   */
  async getSessions() {
    const response = await this.request('/sessions');
    
    if (response.ok) {
      return response.data.sessions;
    }

    throw new Error(response.message || 'Error obteniendo sesiones');
  }

  /**
   * Invalida una sesión específica
   */
  async invalidateSession(sessionId) {
    const response = await this.request(`/sessions/${sessionId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      return true;
    }

    throw new Error(response.message || 'Error invalidando sesión');
  }

  /**
   * Obtiene lista de usuarios (solo admin)
   */
  async getUsers(page = 1, limit = 10, search = '') {
    const params = new URLSearchParams({ page, limit, search });
    const response = await this.request(`/users?${params}`);
    
    if (response.ok) {
      return response.data;
    }

    throw new Error(response.message || 'Error obteniendo usuarios');
  }

  /**
   * Obtiene un usuario específico
   */
  async getUser(userId) {
    const response = await this.request(`/users/${userId}`);
    
    if (response.ok) {
      return response.data.user;
    }

    throw new Error(response.message || 'Error obteniendo usuario');
  }

  /**
   * Actualiza un usuario
   */
  async updateUser(userId, updateData) {
    const response = await this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });

    if (response.ok) {
      return response.data.user;
    }

    throw new Error(response.message || 'Error actualizando usuario');
  }

  /**
   * Asigna rol a usuario (solo admin)
   */
  async assignRole(userId, rolId) {
    const response = await this.request(`/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ rolId })
    });

    if (response.ok) {
      return true;
    }

    throw new Error(response.message || 'Error asignando rol');
  }

  /**
   * Remueve rol de usuario (solo admin)
   */
  async removeRole(userId, roleId) {
    const response = await this.request(`/users/${userId}/roles/${roleId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      return true;
    }

    throw new Error(response.message || 'Error removiendo rol');
  }

  /**
   * Guarda tokens en localStorage
   */
  setTokens(tokens) {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }
  }

  /**
   * Limpia tokens del localStorage
   */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  /**
   * Verifica si hay una sesión activa
   */
  isAuthenticated() {
    return !!this.accessToken;
  }

  /**
   * Obtiene el token de acceso actual
   */
  getAccessToken() {
    return this.accessToken;
  }
}

// Ejemplo de uso
const api = new LoginShokerAPI();

// Registro
try {
  const result = await api.register('usuario@example.com', 'MiPassword123!', 'Juan Pérez');
  console.log('Usuario registrado:', result.user);
} catch (error) {
  console.error('Error en registro:', error.message);
}

// Login
try {
  const result = await api.login('usuario@example.com', 'MiPassword123!');
  console.log('Login exitoso:', result.user);
} catch (error) {
  console.error('Error en login:', error.message);
}

// Obtener perfil
try {
  const profile = await api.getProfile();
  console.log('Perfil:', profile.user);
} catch (error) {
  console.error('Error obteniendo perfil:', error.message);
}

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoginShokerAPI;
}