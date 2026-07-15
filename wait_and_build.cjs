const { spawn } = require('child_process');
const build = spawn('npm', ['run', 'build']);
build.stdout.on('data', data => console.log(data.toString()));
build.stderr.on('data', data => console.error(data.toString()));
