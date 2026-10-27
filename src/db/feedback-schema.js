export const FEEDBACK_COLUMNS=['id','event_key','author_id','author_name','guild_id','guild_name','eso_server','category','subject','message','status','revision','created_at','reviewed_at','reviewed_by','review_notes'];
export function feedbackSchema(type){
 const maria=type==='mariadb',id=maria?'BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY':'INTEGER PRIMARY KEY AUTOINCREMENT',suffix=maria?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci':'';
 return [`CREATE TABLE IF NOT EXISTS app_feedback (id ${id},event_key VARCHAR(64) NOT NULL UNIQUE,author_id VARCHAR(32) NOT NULL,author_name VARCHAR(255) NOT NULL,guild_id VARCHAR(32) NOT NULL,guild_name VARCHAR(255) NOT NULL,eso_server VARCHAR(32) NOT NULL,category VARCHAR(16) NOT NULL,subject VARCHAR(120) NOT NULL,message TEXT NOT NULL,status VARCHAR(16) NOT NULL DEFAULT 'new',revision INT NOT NULL DEFAULT 1,created_at VARCHAR(24) NOT NULL,reviewed_at VARCHAR(24) NULL,reviewed_by VARCHAR(32) NULL,review_notes TEXT NULL)${suffix}`,
 ...['status_time ON app_feedback(status,created_at,id)','author_time ON app_feedback(author_id,created_at,id)'].map(index=>`CREATE INDEX ${maria?'':'IF NOT EXISTS '}idx_feedback_${index}`)];
}
export async function migrateFeedback(db){
 if((await db.query('SELECT version FROM schema_migrations WHERE version=14')).length)return;
 for(const sql of feedbackSchema(db.type)){try{await db.query(sql);}catch(e){if(!sql.startsWith('CREATE INDEX')||!(e.code==='ER_DUP_KEYNAME'||e.errno===1061))throw e;}}
 await db.query('INSERT INTO schema_migrations(version) VALUES (14)');
}
