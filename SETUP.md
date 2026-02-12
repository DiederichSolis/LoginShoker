# LoginShoker Backend - Setup Guide

## 🚀 Guía rápida de configuración

### 1. Configurar Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto
2. Ve a Settings > API para obtener:
   - Project URL
   - Anon key
   - Service role key (secret)

### 2. Crear las tablas

Ve a SQL Editor en tu proyecto de Supabase y ejecuta:

```sql
-- Tabla usuarios
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT,
  activo BOOLEAN DEFAULT true,
  bloqueado BOOLEAN DEFAULT false,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Índices para usuarios
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);
CREATE INDEX idx_usuarios_fecha_creacion ON usuarios(fecha_creacion);

-- Tabla roles
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL
);

-- Insertar roles por defecto
INSERT INTO roles (nombre) VALUES ('admin'), ('empleado'), ('cliente');

-- Tabla usuario_roles
CREATE TABLE usuario_roles (
  id SERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_id INT REFERENCES roles(id),
  UNIQUE(usuario_id, rol_id)
);

-- Índices para usuario_roles
CREATE INDEX idx_usuario_roles_usuario_id ON usuario_roles(usuario_id);
CREATE INDEX idx_usuario_roles_rol_id ON usuario_roles(rol_id);

-- Tabla sesiones
CREATE TABLE sesiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  refresh_token TEXT UNIQUE NOT NULL,
  user_agent TEXT,
  ip TEXT,
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_expiracion TIMESTAMP NOT NULL,
  activo BOOLEAN DEFAULT true
);

-- Índices para sesiones
CREATE INDEX idx_sesiones_usuario_id ON sesiones(usuario_id);
CREATE INDEX idx_sesiones_refresh_token ON sesiones(refresh_token);
CREATE INDEX idx_sesiones_activo ON sesiones(activo);
CREATE INDEX idx_sesiones_fecha_expiracion ON sesiones(fecha_expiracion);
```

### 3. Configurar variables de entorno

Copia `.env.example` a `.env` y completa:

```env
NODE_ENV=development
PORT=3000

# Supabase - Reemplaza con tus valores reales
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui

# JWT - CAMBIA ESTE SECRET EN PRODUCCIÓN
JWT_SECRET=tu_secreto_super_seguro_y_largo_para_jwt_tokens_cambiar_en_produccion
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Security
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME_MINUTES=15

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Instalar y ejecutar

```bash
# Instalar dependencias
npm install

# Ejecutar migraciones (opcional)
npm run migrate

# Iniciar en modo desarrollo
npm run dev
```

### 5. Probar la API

```bash
# Ejecutar tests automáticos
node tests/api-test.js

# O hacer pruebas manuales
curl http://localhost:3000/health
```

## ✅ Checklist de configuración

- [ ] Proyecto de Supabase creado
- [ ] Tablas creadas en Supabase
- [ ] Variables de entorno configuradas
- [ ] Dependencias instaladas (`npm install`)
- [ ] Servidor iniciado (`npm run dev`)
- [ ] Tests pasando (`node tests/api-test.js`)

## 🔧 Crear usuario administrador

Puedes crear un usuario administrador usando la migración:

```javascript
const { createDefaultAdmin } = require('./migrations/migrate');

// Ejecutar esto una vez para crear admin
createDefaultAdmin('admin@tudominio.com', 'AdminPassword123!', 'Administrador');
```

## 🚨 Importante para producción

1. **Cambiar JWT_SECRET** a algo completamente aleatorio y seguro
2. **Configurar CORS** con tu dominio real en `src/index.js`
3. **Configurar HTTPS** con certificado SSL
4. **Configurar logging** para producción
5. **Configurar monitoring** y alertas
6. **Revisar rate limits** según tu tráfico esperado

## 📚 Documentación adicional

- [README.md](./README.md) - Documentación completa
- [examples/frontend-client.js](./examples/frontend-client.js) - Cliente JavaScript
- [tests/api-test.js](./tests/api-test.js) - Ejemplos de uso de la API