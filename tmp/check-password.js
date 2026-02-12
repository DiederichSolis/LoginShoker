const bcrypt = require('bcryptjs');
const hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lXKjBw4zzG6i';
(async ()=>{
  try{
    const r1 = await bcrypt.compare('123456', hash);
    const r2 = await bcrypt.compare('cambiar123', hash);
    console.log('match results -> 123456:', r1, ', cambiar123:', r2);
    process.exit(0);
  }catch(e){
    console.error(e);
    process.exit(1);
  }
})();
