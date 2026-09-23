import { runSeed } from '../src/seed/run.js';

const { users, patients } = await runSeed();
console.log(`seed complete: ${patients} patients, ${users} users (password: password123)`);
process.exit(0);