require('dotenv').config();

/**
 * Script de prueba para verificar que la API funciona correctamente
 */
async function testAPI() {
  const baseURL = `http://localhost:${process.env.PORT || 3000}/api`;
  
  console.log('🧪 Iniciando pruebas de la API LoginShoker...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Health check...');
    const healthResponse = await fetch(`http://localhost:${process.env.PORT || 3000}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Servidor funcionando:', healthData.message);
    console.log('');

    // Test 2: Registro de usuario
    console.log('2️⃣ Registrando usuario de prueba...');
    const registerResponse = await fetch(`${baseURL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test.${Date.now()}@example.com`,
        password: 'TestPassword123!',
        nombre: 'Usuario de Prueba'
      })
    });
    
    const registerData = await registerResponse.json();
    if (registerData.success) {
      console.log('✅ Usuario registrado exitosamente');
      console.log('📧 Email:', registerData.data.user.email);
      console.log('🎭 Roles:', registerData.data.user.roles.map(r => r.nombre));
    } else {
      console.log('❌ Error en registro:', registerData.message);
      return;
    }
    console.log('');

    const { accessToken, refreshToken } = registerData.data.tokens;
    const userEmail = registerData.data.user.email;

    // Test 3: Login
    console.log('3️⃣ Probando login...');
    const loginResponse = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        password: 'TestPassword123!'
      })
    });

    const loginData = await loginResponse.json();
    if (loginData.success) {
      console.log('✅ Login exitoso');
    } else {
      console.log('❌ Error en login:', loginData.message);
    }
    console.log('');

    // Test 4: Obtener perfil
    console.log('4️⃣ Obteniendo perfil de usuario...');
    const profileResponse = await fetch(`${baseURL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const profileData = await profileResponse.json();
    if (profileData.success) {
      console.log('✅ Perfil obtenido exitosamente');
      console.log('👤 Usuario:', profileData.data.user.nombre);
      console.log('📊 Sesiones activas:', profileData.data.sessionStats.activeSessions);
    } else {
      console.log('❌ Error obteniendo perfil:', profileData.message);
    }
    console.log('');

    // Test 5: Verificar token
    console.log('5️⃣ Verificando token...');
    const verifyResponse = await fetch(`${baseURL}/auth/verify`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const verifyData = await verifyResponse.json();
    if (verifyData.success) {
      console.log('✅ Token válido');
      console.log('🔑 Roles:', verifyData.data.user.roles);
    } else {
      console.log('❌ Token inválido:', verifyData.message);
    }
    console.log('');

    // Test 6: Refresh token
    console.log('6️⃣ Renovando tokens...');
    const refreshResponse = await fetch(`${baseURL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const refreshData = await refreshResponse.json();
    if (refreshData.success) {
      console.log('✅ Tokens renovados exitosamente');
    } else {
      console.log('❌ Error renovando tokens:', refreshData.message);
    }
    console.log('');

    // Test 7: Sesiones activas
    console.log('7️⃣ Obteniendo sesiones activas...');
    const sessionsResponse = await fetch(`${baseURL}/auth/sessions`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const sessionsData = await sessionsResponse.json();
    if (sessionsData.success) {
      console.log('✅ Sesiones obtenidas');
      console.log('📱 Dispositivos activos:', sessionsData.data.sessions.length);
      sessionsData.data.sessions.forEach((session, index) => {
        console.log(`   ${index + 1}. ${session.user_agent} (${session.ip})`);
      });
    } else {
      console.log('❌ Error obteniendo sesiones:', sessionsData.message);
    }
    console.log('');

    // Test 8: Cambio de contraseña
    console.log('8️⃣ Cambiando contraseña...');
    const changePasswordResponse = await fetch(`${baseURL}/auth/change-password`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        currentPassword: 'TestPassword123!',
        newPassword: 'NewTestPassword123!'
      })
    });

    const changePasswordData = await changePasswordResponse.json();
    if (changePasswordData.success) {
      console.log('✅ Contraseña cambiada exitosamente');
    } else {
      console.log('❌ Error cambiando contraseña:', changePasswordData.message);
    }
    console.log('');

    // Test 9: Logout
    console.log('9️⃣ Cerrando sesión...');
    const logoutResponse = await fetch(`${baseURL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const logoutData = await logoutResponse.json();
    if (logoutData.success) {
      console.log('✅ Sesión cerrada exitosamente');
    } else {
      console.log('❌ Error en logout:', logoutData.message);
    }
    console.log('');

    // Test 10: Verificar que el token ya no funciona
    console.log('🔟 Verificando que el token esté invalidado...');
    const invalidTokenResponse = await fetch(`${baseURL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const invalidTokenData = await invalidTokenResponse.json();
    if (!invalidTokenData.success && invalidTokenData.code === 'INVALID_SESSION') {
      console.log('✅ Token correctamente invalidado después del logout');
    } else {
      console.log('⚠️ El token sigue siendo válido después del logout');
    }

    console.log('\n🎉 ¡Todas las pruebas completadas!');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
  }
}

// Función helper para hacer requests con manejo de errores
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, options);
    return await response.json();
  } catch (error) {
    console.error('Error de red:', error.message);
    throw error;
  }
}

// Ejecutar pruebas si este archivo se ejecuta directamente
if (require.main === module) {
  testAPI().catch(console.error);
}

module.exports = { testAPI };