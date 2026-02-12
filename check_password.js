const bcrypt = require('bcryptjs');

// Hash del usuario diederich.josue.emidio@gmail.com
const hashToCheck = '$2a$12$aKXAM3J.xiCidoGkM0GkxeHOBYFI1fg2asUx.I6kOvdE0Ah/nvIzy';

// Hash de los otros usuarios (que usan 123456)
const hashOtrosUsuarios = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lXKjBw4zzG6i';

// Contraseñas a probar
const passwordsToTest = [
    '123456',
    'password',
    'admin',
    'shoker',
    'diederich',
    'josue'
];

async function checkPasswords() {
    console.log('🔍 Verificando hash del usuario diederich.josue.emidio@gmail.com\n');
    console.log('Hash a verificar:', hashToCheck);
    console.log('\n--- Probando contraseñas comunes ---\n');

    for (const password of passwordsToTest) {
        const isMatch = await bcrypt.compare(password, hashToCheck);
        console.log(`${isMatch ? '✅' : '❌'} "${password}": ${isMatch ? 'MATCH!' : 'no match'}`);
    }

    console.log('\n--- Verificando hash de otros usuarios ---\n');
    const match123456 = await bcrypt.compare('123456', hashOtrosUsuarios);
    console.log(`${match123456 ? '✅' : '❌'} Hash de otros usuarios con "123456": ${match123456 ? 'MATCH!' : 'no match'}`);
}

checkPasswords().catch(console.error);
