export function houseImageSchema(type){
 const maria=type==='mariadb';
 return `CREATE TABLE IF NOT EXISTS house_images (id ${maria?'BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY':'INTEGER PRIMARY KEY AUTOINCREMENT'},saved_house_id ${maria?'BIGINT UNSIGNED':'INTEGER'} NOT NULL,storage_key VARCHAR(64) NOT NULL UNIQUE,caption VARCHAR(250) NOT NULL DEFAULT '',position INT NOT NULL DEFAULT 0,created_by VARCHAR(32) NOT NULL,created_at ${maria?'DATETIME':'TEXT'} NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(saved_house_id) REFERENCES saved_houses(id) ON DELETE CASCADE)${maria?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci':''}`;
}
export async function migrateHouseImages(db){
 if((await db.query('SELECT version FROM schema_migrations WHERE version=15')).length)return;
 await db.query(houseImageSchema(db.type));
 try{await db.query('CREATE INDEX idx_house_images ON house_images(saved_house_id,position)');}catch(error){if(error.code!=='ER_DUP_KEYNAME'&&error.errno!==1061&&!/already exists/.test(error.message))throw error;}
 await db.query('INSERT INTO schema_migrations(version) VALUES (15)');
}
