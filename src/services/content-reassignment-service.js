import {createHash} from 'node:crypto';
import {one,withTransaction} from '../db/database.js';

const tableFor=kind=>kind==='house'?'saved_houses':kind==='tour'?'tours':null;
const recordId=value=>{const id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw new Error('Invalid record selection.');return id;};
export function parseDiscordMemberId(input){
 const match=/^(?:<@!?(\d{17,20})>|(\d{17,20}))$/.exec(String(input||'').trim());
 if(!match)throw new Error('Enter a Discord member ID or mention.');
 return match[1]||match[2];
}
const guildFor=(record,kind,c)=>(kind==='house'?record.scope:record.visibility)==='global'?c.guildId:(kind==='tour'?record.source_guild_id||record.guild_id:record.guild_id);
export function canReassignShared(record,kind,c){
 if(!tableFor(kind)||!record||record.eso_server!==c.esoServer)return false;
 const visibility=kind==='house'?record.scope:record.visibility;
 if(!['public','global'].includes(visibility))return false;
 return Boolean(c.isOwner||c.isGlobalAdmin||(visibility==='public'&&c.isServerAdmin&&guildFor(record,kind,c)===c.guildId));
}
const versionFor=(record,candidateId,guildId)=>createHash('sha256').update(JSON.stringify({record,candidateId,guildId})).digest('hex');

export class ContentReassignmentService {
 constructor(workspace,{memberLookup}={}){this.w=workspace;this.db=workspace.db;this.memberLookup=memberLookup;}
 async record(context,kind,id,connection=this.db){
  const c=await this.w.fresh(context),table=tableFor(kind);
  if(!table)throw new Error('Invalid record type.');
  const record=await one(connection,`SELECT * FROM ${table} WHERE id=?`,[recordId(id)]);
  if(!canReassignShared(record,kind,c))throw new Error('Shared record reassignment is not available with your current administrative access.');
  return {c,record};
 }
 async candidate(c,record,kind,candidateId){
  if(typeof this.memberLookup!=='function')throw new Error('Live Discord membership lookup is unavailable. Try again later.');
  const guildId=guildFor(record,kind,c);if(!guildId)throw new Error('The record has no available Discord server.');
  if(guildId!==c.guildId){const actor=await this.memberLookup({guildId,userId:c.userId});if(!actor||actor.id!==c.userId)throw new Error('You must be a current member of this record’s Discord server.');}
  const member=await this.memberLookup({guildId,userId:candidateId});
  if(!member||member.id!==candidateId)throw new Error('The selected user must be a current member of the Discord server.');
  return {guildId,member:{id:candidateId,username:member.username||null,globalName:member.globalName||member.username||null,displayName:member.displayName||member.globalName||member.username||null}};
 }
 async preview(context,kind,id,input){
  const candidateId=parseDiscordMemberId(input),{c,record}=await this.record(context,kind,id),{member,guildId}=await this.candidate(c,record,kind,candidateId);
  return {record,member,guildId,version:versionFor(record,candidateId,guildId)};
 }
 async confirm(context,kind,id,input,version){
  const candidateId=parseDiscordMemberId(input);
  const {c,record:current}=await this.record(context,kind,id),{member,guildId}=await this.candidate(c,current,kind,candidateId);
  return withTransaction(this.db,async conn=>{
   const table=tableFor(kind);if(!table)throw new Error('Invalid record type.');
   await one(conn,`SELECT id FROM ${table} WHERE id=? FOR UPDATE`,[recordId(id)]);
   const record=await one(conn,`SELECT * FROM ${table} WHERE id=?`,[recordId(id)]);
   if(!canReassignShared(record,kind,c))throw new Error('Shared record reassignment is not available with your current administrative access.');
   if(version!==versionFor(record,candidateId,guildId))throw new Error('This record or selected member changed. Review the reassignment again.');
   const before=kind==='house'?{id:record.created_by,globalName:record.created_by_global_name,displayName:record.created_by_display_name}:{id:record.creator_id,globalName:record.creator_global_name,displayName:record.creator_display_name};
   if(kind==='house')await conn.query('UPDATE saved_houses SET created_by=?,created_by_global_name=?,created_by_display_name=?,updated_by=?,updated_by_global_name=NULL,updated_by_display_name=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?',[member.id,member.globalName,member.displayName,c.userId,record.id]);
   else await conn.query('UPDATE tours SET creator_id=?,creator_global_name=?,creator_display_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[member.id,member.globalName,member.displayName,record.id]);
   await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,entity_name,details) VALUES(?,?,?,?,?,?,?)',[guildId,c.userId,kind==='house'?'reassign_house_submitter':'reassign_tour_creator',kind==='house'?'saved_house':'tour',String(record.id),record.display_name||record.name||null,JSON.stringify({source:'web',before,after:{id:member.id,globalName:member.globalName,displayName:member.displayName}})]);
   return {record:await one(conn,`SELECT * FROM ${table} WHERE id=?`,[record.id]),member,guildId};
  });
 }
}
