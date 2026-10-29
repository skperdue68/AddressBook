import {csrfField} from './workspace-render.js';
export function tourContinueControls(id,current,csrf,{player=false}={}){
 const complete=current?.status==='completed',continuable=!!current&&(!complete||current.canResume),action=complete&&!continuable?'restart':'start',label=complete&&!continuable?'Restart tour':current?'Continue tour':'Start tour';
 const form=(kind,text,primary)=>`<form action="/app/tours/${Number(id)}/${player?'play':kind}" method="post">${csrfField(csrf)}${player?`<input type="hidden" name="action" value="${kind}">`:''}<button${primary?' class="primary"':''}>${text}</button></form><!-- independent tour action -->`;
 return form(action,label,true)+(complete&&continuable?form('restart','Restart tour',false):'');
}
