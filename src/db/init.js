import 'dotenv/config';
import { openDatabase, migrate, closeDatabase, ensureMariaDatabase } from './database.js';
if(String(process.env.DB_TYPE||'sqlite').toLowerCase()==='mariadb')await ensureMariaDatabase();
const db=openDatabase();
try{
  await migrate(db);
  console.log(`${db.type === 'mariadb' ? 'MariaDB' : 'SQLite'} schema initialized.`);
}finally{ await closeDatabase(db); }
