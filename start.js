const { spawn } = require('child_process');
const path = require('path');

console.log('====================================================');
console.log('  Barbershop Queue App Starter (Node.js runner)');
console.log('====================================================\n');

const runService = (name, dir, command, args) => {
  const process = spawn(command, args, {
    cwd: path.join(__dirname, dir),
    shell: true,
    stdio: 'inherit'
  });

  process.on('close', (code) => {
    console.log(`[${name}] Process exited with code ${code}`);
  });

  return process;
};

console.log('Starting Backend Server...');
const server = runService('Backend', 'server', 'npm', ['run', 'dev']);

console.log('Starting Frontend Client...');
const client = runService('Frontend', 'client', 'npm', ['run', 'dev']);

// Handle graceful shutdown of children on exit
process.on('SIGINT', () => {
  console.log('\nStopping all services...');
  server.kill();
  client.kill();
  process.exit();
});
process.on('SIGTERM', () => {
  server.kill();
  client.kill();
  process.exit();
});
