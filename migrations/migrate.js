require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');
const RoleModel = require('../src/models/RoleModel');
const logger = require('../src/utils/logger');

/**
 * Script de migración para inicializar la base de datos
 */
async function runMigrations() {
  try {
    logger.info('🚀 Iniciando migraciones...');

    // Crear tablas si no existen
    await createTables();
    
    // Inicializar roles por defecto
    await initializeDefaultRoles();

    logger.info('✅ Migraciones completadas exitosamente');
  } catch (error) {
    logger.error('❌ Error en migraciones', error);
    process.exit(1);
  }
}

/**
 * Crea las tablas necesarias en Supabase
 */
async function createTables() {
  logger.info('📋 Creando tablas...');

  // Tabla usuarios
  const createUsuariosTable = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nombre TEXT,
      activo BOOLEAN DEFAULT true,
      bloqueado BOOLEAN DEFAULT false,
      fecha_creacion TIMESTAMP DEFAULT NOW()
    );

    -- Índices para usuarios
    CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
    CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);
    CREATE INDEX IF NOT EXISTS idx_usuarios_fecha_creacion ON usuarios(fecha_creacion);
  `;

  // Tabla roles
  const createRolesTable = `
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      nombre TEXT UNIQUE NOT NULL
    );

    -- Insertar roles por defecto si no existen
    INSERT INTO roles (nombre) VALUES ('admin'), ('empleado'), ('cliente')
    ON CONFLICT (nombre) DO NOTHING;
  `;

  // Tabla usuario_roles
  const createUsuarioRolesTable = `
    CREATE TABLE IF NOT EXISTS usuario_roles (
      id SERIAL PRIMARY KEY,
      usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
      rol_id INT REFERENCES roles(id),
      UNIQUE(usuario_id, rol_id)
    );

    -- Índices para usuario_roles
    CREATE INDEX IF NOT EXISTS idx_usuario_roles_usuario_id ON usuario_roles(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_usuario_roles_rol_id ON usuario_roles(rol_id);
  `;

  // Tabla sesiones
  const createSesionesTable = `
    CREATE TABLE IF NOT EXISTS sesiones (
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
    CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_id ON sesiones(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_sesiones_refresh_token ON sesiones(refresh_token);
    CREATE INDEX IF NOT EXISTS idx_sesiones_activo ON sesiones(activo);
    CREATE INDEX IF NOT EXISTS idx_sesiones_fecha_expiracion ON sesiones(fecha_expiracion);
  `;

  try {
    // Ejecutar creación de tablas
    await supabaseAdmin.rpc('execute_sql', { sql: createUsuariosTable });
    logger.info('  ✅ Tabla usuarios creada');

    await supabaseAdmin.rpc('execute_sql', { sql: createRolesTable });
    logger.info('  ✅ Tabla roles creada');

    await supabaseAdmin.rpc('execute_sql', { sql: createUsuarioRolesTable });
    logger.info('  ✅ Tabla usuario_roles creada');

    await supabaseAdmin.rpc('execute_sql', { sql: createSesionesTable });
    logger.info('  ✅ Tabla sesiones creada');

  } catch (error) {
    // Si el método rpc no está disponible, las tablas deben crearse manualmente en Supabase
    logger.warn('⚠️  No se pudieron crear tablas automáticamente. Asegúrate de que las tablas existan en Supabase.');
    logger.info('📝 SQL de creación de tablas:');
    console.log('\n-- USUARIOS');
    console.log(createUsuariosTable);
    console.log('\n-- ROLES');
    console.log(createRolesTable);
    console.log('\n-- USUARIO_ROLES');
    console.log(createUsuarioRolesTable);
    console.log('\n-- SESIONES');
    console.log(createSesionesTable);
  }
}

/**
 * Inicializa roles por defecto
 */
async function initializeDefaultRoles() {
  try {
    logger.info('👥 Inicializando roles por defecto...');
    
    const createdRoles = await RoleModel.initializeDefaultRoles();
    
    if (createdRoles.length > 0) {
      logger.info(`  ✅ Creados ${createdRoles.length} roles: ${createdRoles.map(r => r.nombre).join(', ')}`);
    } else {
      logger.info('  ℹ️  Todos los roles por defecto ya existen');
    }
  } catch (error) {
    logger.error('Error al inicializar roles', error);
    throw error;
  }
}

/**
 * Función para crear un usuario administrador por defecto
 */
async function createDefaultAdmin(email, password, nombre = 'Administrador') {
  try {
    const UserModel = require('../src/models/UserModel');
    const AuthUtils = require('../src/utils/authUtils');

    logger.info('👤 Creando usuario administrador por defecto...');

    // Verificar si ya existe
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      logger.info('  ℹ️  El usuario administrador ya existe');
      return;
    }

    // Crear usuario
    const user = await UserModel.createUser({ email, password, nombre });
    
    // Asignar rol de admin
    const adminRole = await RoleModel.findByName('admin');
    if (adminRole) {
      await UserModel.assignRole(user.id, adminRole.id);
    }

    logger.info(`  ✅ Usuario administrador creado: ${email}`);
    return user;
  } catch (error) {
    logger.error('Error al crear usuario administrador', error);
    throw error;
  }
}

// Ejecutar migraciones si este archivo se ejecuta directamente
if (require.main === module) {
  runMigrations();
}

module.exports = {
  runMigrations,
  createTables,
  initializeDefaultRoles,
  createDefaultAdmin
};