const bcrypt = require('bcryptjs');

const hash = '$2a$12$aKXAM3J.xiCidoGkM0GkxeHOBYFI1fg2asUx.I6kOvdE0Ah/nvIzy';
const password = '123456';

bcrypt.compare(password, hash, function(err, result) {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('¿La contraseña coincide?', result);
  }
});
