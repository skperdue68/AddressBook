export function tourCoverSchema(type){
 const maria=type==='mariadb';
 return `CREATE TABLE IF NOT EXISTS tour_covers (tour_id ${maria?'BIGINT UNSIGNED':'INTEGER'} NOT NULL PRIMARY KEY,storage_key VARCHAR(64) NOT NULL UNIQUE,created_by VARCHAR(32) NOT NULL,updated_at ${maria?'DATETIME':'TEXT'} NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE CASCADE)${maria?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci':''}`;
}
export async function migrateTourCovers(db){
 if((await db.query('SELECT version FROM schema_migrations WHERE version=16')).length)return;
 await db.query(tourCoverSchema(db.type));
 await db.query('INSERT INTO schema_migrations(version) VALUES (16)');
}
