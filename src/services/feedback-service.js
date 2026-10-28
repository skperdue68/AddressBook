import {pageWindow} from '../utils/pagination.js';
import {createHash} from 'node:crypto';
import {one,withTransaction} from '../db/database.js';
import {botOwnerIds} from '../config/bot-owners.js';

export const feedbackCategories={general:'General feedback',bug:'Bug report',idea:'Idea'};
export const feedbackStatuses={new:'New',reviewed:'Reviewed',resolved:'Resolved'};
const required=(value,label,max)=>{const text=String(value??'').trim();if(!text||text.length>max)throw new Error(`${label} must contain 1–${max} characters.`);return text;};
export class FeedbackService{
 constructor(db,env=process.env){this.db=db;this.env=env;}
 assertOwner(actor){if(!botOwnerIds(this.env).has(String(actor?.userId)))throw new Error('Feedback review is restricted to bot owners.');}
 async submit(context,actor,data){
  if(!context?.userId||!context.guildId||!context.esoServer)throw new Error('Sign in and choose a server before sending feedback.');
  const category=String(data.category||'');if(!Object.hasOwn(feedbackCategories,category))throw new Error('Choose a feedback category.');
  const subject=required(data.subject,'Subject',120),message=required(data.message,'Feedback',4000),key=String(data.eventKey||'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key))throw new Error('Reload the feedback form and try again.');
  const eventKey=createHash('sha256').update(`${context.userId}:${key}`).digest('hex');
  return withTransaction(this.db,async conn=>{
   const existing=await one(conn,'SELECT id,status FROM app_feedback WHERE event_key=?',[eventKey]);if(existing)return existing;
   await conn.query('INSERT INTO app_feedback(event_key,author_id,author_name,guild_id,guild_name,eso_server,category,subject,message,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[eventKey,String(context.userId),String(actor.name||context.userId).slice(0,255),String(context.guildId),String(context.guildName||context.guildId).slice(0,255),context.esoServer,category,subject,message,new Date().toISOString()]);
   return one(conn,'SELECT id,status FROM app_feedback WHERE event_key=?',[eventKey]);
  });
 }
 mine(userId){return this.db.query('SELECT id,category,subject,message,status,created_at FROM app_feedback WHERE author_id=? ORDER BY created_at DESC,id DESC LIMIT 10',[String(userId)]);}
 async list(actor,{status='',page=1}={}){
  this.assertOwner(actor);if(status&&!Object.hasOwn(feedbackStatuses,status))throw new Error('Invalid feedback status.');
  const where=status?'WHERE status=?':'',args=status?[status]:[];
  const total=Number((await one(this.db,`SELECT count(*) n FROM app_feedback ${where}`,args)).n);
  page=pageWindow(page,total).page;
  const rows=await this.db.query(`SELECT * FROM app_feedback ${where} ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET ?`,[...args,(page-1)*25]);
  return {rows,total,page,hasNext:page*25<total};
 }
 async review(actor,{id,revision,status,notes}){
  this.assertOwner(actor);id=Number(id);revision=Number(revision);
  if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(revision)||revision<1||(status!==undefined&&!Object.hasOwn(feedbackStatuses,status))||(status===undefined&&notes===undefined))throw new Error('Invalid review.');
  if(notes!==undefined)notes=String(notes).trim();if(notes!==undefined&&notes.length>1000)throw new Error('Internal notes must contain at most 1000 characters.');
  return withTransaction(this.db,async conn=>{
   const row=await one(conn,'SELECT * FROM app_feedback WHERE id=? FOR UPDATE',[id]);
   if(!row||Number(row.revision)!==revision)throw new Error('This feedback changed or is unavailable. Reload the inbox.');
   await conn.query('UPDATE app_feedback SET status=?,review_notes=?,reviewed_by=?,reviewed_at=?,revision=revision+1 WHERE id=? AND revision=?',[status??row.status,notes??row.review_notes,String(actor.userId),this.db.type==='mariadb'?new Date():new Date().toISOString(),id,revision]);
   return one(conn,'SELECT * FROM app_feedback WHERE id=?',[id]);
  });
 }
}
