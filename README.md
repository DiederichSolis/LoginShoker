# LoginShoker Backend 🚀

Backend completo en Node.js para manejo de autenticación y autorización con Supabase.

## 🌟 Características

- **Autenticación completa**: Registro, login, logout con JWT y refresh tokens
- **Manejo de sesiones**: Múltiples sesiones por usuario con control individual
- **Sistema de roles**: Roles flexibles con control de permisos
- **Seguridad robusta**: Hashing de contraseñas, rate limiting, validaciones
- **API RESTful**: Endpoints bien estructurados y documentados
- **Middleware robusto**: Autenticación, autorización, validación y manejo de errores
- **Logging**: Sistema de logging completo para debugging y monitoring

## 🏗️ Arquitectura

### Estructura del proyecto
```
src/
├── config/           # Configuraciones (Supabase, etc.)
├── controllers/      # Controladores de API
├── middleware/       # Middlewares de autenticación, validación, etc.
├── models/          # Modelos de datos (Supabase)
├── routes/          # Definición de rutas
├── services/        # Lógica de negocio
├── utils/           # Utilidades y helpers
└── index.js         # Punto de entrada del servidor

migrations/          # Scripts de migración de DB
```

### Tablas de la base de datos

#### 👤 `usuarios`
- Almacena información básica y credenciales
- Campos: id, email, password_hash, nombre, activo, bloqueado, fecha_creacion

#### 👥 `roles`  
- Define tipos de usuario del sistema
- Roles por defecto: admin, empleado, cliente

#### 🔗 `usuario_roles`
- Relación muchos a muchos entre usuarios y roles
- Permite múltiples roles por usuario

#### 🔑 `sesiones`
- Manejo de sesiones múltiples por usuario
- Control de dispositivos y expiración
- Campos: id, usuario_id, refresh_token, user_agent, ip, fecha_expiracion, activo

## 🚀 Instalación

1. **Clona el repositorio**
```bash
git clone <tu-repo>
cd LoginShoker
```

2. **Instala dependencias**
```bash
npm install
```

3. **Configura variables de entorno**
```bash
cp .env.example .env
```

Edita `.env` con tus valores:
```env
NODE_ENV=development
PORT=3000

# Supabase
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# JWT
JWT_SECRET=tu_secreto_super_seguro
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Security
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME_MINUTES=15
```

4. **Crea las tablas en Supabase**

Ejecuta estos SQLs en tu proyecto de Supabase:

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

-- Tabla roles
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL
);

-- Tabla usuario_roles
CREATE TABLE usuario_roles (
  id SERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_id INT REFERENCES roles(id),
  UNIQUE(usuario_id, rol_id)
);

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

-- Insertar roles por defecto
INSERT INTO roles (nombre) VALUES ('admin'), ('empleado'), ('cliente');
```

5. **Ejecuta migraciones** (opcional)
```bash
npm run migrate
```

6. **Inicia el servidor**
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 📚 API Endpoints

### 🔐 Autenticación (`/api/auth`)

| Método | Endpoint | Descripción | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Registrar nuevo usuario | No |
| POST | `/login` | Iniciar sesión | No |
| POST | `/refresh` | Renovar tokens | No (refresh token) |
| POST | `/logout` | Cerrar sesión | No |
| POST | `/logout-all` | Cerrar todas las sesiones | Sí |
| POST | `/change-password` | Cambiar contraseña | Sí |
| GET | `/me` | Obtener perfil | Sí |
| POST | `/verify` | Verificar token | Sí |
| GET | `/sessions` | Sesiones activas | Sí |
| DELETE | `/sessions/:id` | Invalidar sesión | Sí |

### 👥 Usuarios (`/api/users`)

| Método | Endpoint | Descripción | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Listar usuarios | Admin |
| GET | `/profile` | Obtener perfil propio | Sí |
| PUT | `/profile` | Actualizar perfil propio | Sí |
| GET | `/:userId` | Obtener usuario | Admin o Propio |
| PUT | `/:userId` | Actualizar usuario | Admin o Propio |
| DELETE | `/:userId` | Desactivar usuario | Admin |
| POST | `/:userId/roles` | Asignar rol | Admin |
| DELETE | `/:userId/roles/:roleId` | Remover rol | Admin |
| GET | `/:userId/roles` | Obtener roles de usuario | Admin o Propio |

### 🔑 Sesiones (`/api/sessions`)

| Método | Endpoint | Descripción | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Obtener sesiones activas | Sí |
| GET | `/stats` | Estadísticas de sesiones | Sí |
| DELETE | `/:sessionId` | Invalidar sesión específica | Sí |
| DELETE | `/all` | Invalidar todas las sesiones | Sí |
| DELETE | `/cleanup` | Limpiar sesiones expiradas | Admin |

## 🔧 Uso de la API

### Registro de usuario
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "MiPassword123!",
    "nombre": "Juan Pérez"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "MiPassword123!"
  }'
```

### Usar token de acceso
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer tu_access_token"
```

### Renovar tokens
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "tu_refresh_token"
  }'
```

## 🔒 Sistema de Roles y Permisos

### Roles por defecto:
- **admin**: Acceso total al sistema
- **empleado**: Acceso limitado según necesidades del negocio
- **cliente**: Acceso básico, solo a su información

### Middlewares de autorización:
- `requireRole(...roles)`: Requiere uno de los roles especificados
- `requireAdmin`: Requiere rol de admin
- `requireOwnershipOrAdmin`: Requiere ser admin o dueño del recurso

## 🛡️ Seguridad

### Características implementadas:
- ✅ **Hashing de contraseñas** con bcrypt (12 rounds)
- ✅ **JWT tokens** con expiración corta (15m por defecto)  
- ✅ **Refresh tokens** seguros con expiración larga (7d por defecto)
- ✅ **Rate limiting** para prevenir ataques de fuerza bruta
- ✅ **CORS** configurado para producción
- ✅ **Helmet** para headers de seguridad
- ✅ **Validación de entrada** con express-validator
- ✅ **Logging** de eventos de seguridad
- ✅ **Manejo de errores** sin exposición de información sensible

### Validaciones de contraseña:
- Mínimo 8 caracteres
- Al menos 1 mayúscula
- Al menos 1 minúscula  
- Al menos 1 número
- Al menos 1 carácter especial

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Ejecutar con coverage
npm run test:coverage
```

## 📊 Monitoring y Logging

El sistema incluye logging completo con diferentes niveles:
- **INFO**: Operaciones exitosas
- **WARN**: Advertencias y eventos sospechosos
- **ERROR**: Errores con stack traces
- **DEBUG**: Información detallada (solo en desarrollo)

## 🔄 Flujo de Autenticación

1. **Registro/Login** → Genera access token (corta duración) + refresh token (larga duración)
2. **Request API** → Usa access token en header Authorization
3. **Token expirado** → Usa refresh token para obtener nuevo access token
4. **Logout** → Invalida refresh token en base de datos

## 🚦 Estados de Usuario

- **activo: true/false** → Controla si puede loguearse
- **bloqueado: true/false** → Bloqueo temporal por seguridad
- Ambos son verificados en cada request autenticado

## 📈 Escalabilidad

### Características para producción:
- **Sesiones múltiples**: Un usuario puede estar logueado en varios dispositivos
- **Invalidación granular**: Puede cerrar sesiones individuales
- **Limpieza automática**: Sesiones expiradas se pueden limpiar periódicamente
- **Rate limiting**: Protección contra ataques
- **Logging estructurado**: Para monitoring y alertas

## 🔧 Mantenimiento

### Tareas periódicas recomendadas:
```bash
# Limpiar sesiones expiradas (ejecutar diariamente)
curl -X DELETE http://localhost:3000/api/sessions/cleanup \
  -H "Authorization: Bearer admin_token"
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 🆘 Soporte

Si tienes preguntas o problemas:
1. Revisa la documentación
2. Busca en los Issues existentes
3. Crea un nuevo Issue con detalles del problema

---

**Desarrollado por Diederich Solis** 🚀