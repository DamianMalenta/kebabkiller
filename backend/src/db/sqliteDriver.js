import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sqliteModuleId = ['node', 'sqlite'].join(':');
const { DatabaseSync } = require(sqliteModuleId);

export { DatabaseSync };
