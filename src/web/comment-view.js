import {escape} from './render.js';

export function renderComments(comments,userId){
 if(!comments?.length)return '<p>No comments yet.</p>';
 return `<div class="comments">${comments.map(c=>{
  const author=c.author_name||c.discord_display_name||c.discord_global_name||c.discord_user_id||'Author unavailable';
  const raw=c.created_at instanceof Date?c.created_at:String(c.created_at||'');
  const date=raw instanceof Date?raw:new Date(/(?:Z|[+-]\d\d:?\d\d)$/.test(raw)?raw:raw.replace(' ','T')+'Z');
  const time=Number.isFinite(date.getTime())?`<time datetime="${date.toISOString()}">${escape(date.toLocaleString('en-US',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))} UTC</time>`:'';
  return `<article class="comment-entry"><p class="comment-heading"><strong>${escape(author)}</strong>${userId!=null&&c.discord_user_id!=null&&String(c.discord_user_id)===String(userId)?' <span class="pill">You</span>':''}${time?` · ${time}`:''}</p><p class="user-text">${escape(c.comment_text)}</p></article>`;
 }).join('\n\n')}</div>`;
}
