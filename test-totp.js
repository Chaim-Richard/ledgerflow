const auth = require('firebase/auth');
console.log(Object.keys(auth).filter(k => k.toLowerCase().includes('totp') || k.toLowerCase().includes('factor')));
