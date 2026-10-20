import { ActionRowBuilder, EmbedBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { HOUSING_PROBLEM_TYPES } from '../services/housing-report-service.js';
import { buttonRows } from './housing-ui.js';

export function reportProblemTypePayload({kind,token}){
  const select=new StringSelectMenuBuilder().setCustomId(`hu:report:type:${kind}:${token}`).setPlaceholder('Choose the problem').setMinValues(1).setMaxValues(1)
    .addOptions(Object.entries(HOUSING_PROBLEM_TYPES).map(([value,label])=>({value,label})));
  return {content:'**Report a Problem**\nChoose the issue that best describes what happened.',embeds:[],components:[new ActionRowBuilder().addComponents(select),...buttonRows([{customId:'hu:home',label:'Cancel',style:'secondary'}])]};
}

export function reportExplanationModal({kind,token,problemType}){
  const input=new TextInputBuilder().setCustomId('explanation').setLabel('What happened? (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000);
  return new ModalBuilder().setCustomId(`hu:modal:report:${kind}:${problemType}:${token}`).setTitle('Report a Housing Problem').addComponents(new ActionRowBuilder().addComponents(input));
}

export function reportQueuePayload(rows){
  const description=rows.length?rows.slice(0,10).map(row=>`**#${row.id}** • ${row.problemLabel}\n${row.targetSummary} • ${row.reporter_global_name||row.reporter_id} • ${row.guild_name||row.guild_id||'No server'} • ${row.status}`).join('\n\n'):'No open housing reports.';
  const embed=new EmbedBuilder().setColor(0x2b7ddd).setTitle('Housing Problem Reports').setDescription(description.slice(0,4096));
  const actions=rows.slice(0,4).map(row=>({customId:`hu:report:review:${row.id}`,label:`Review #${row.id}`,style:'primary'}));
  actions.push({customId:'hu:admin',label:'Back',style:'secondary'});
  return {embeds:[embed],components:buttonRows(actions)};
}

export function reportReviewPayload(report){
  const embed=new EmbedBuilder().setColor(0x2b7ddd).setTitle(`Review Housing Report #${report.id}`).setDescription([
    `**Target:** ${report.targetSummary}`,`**Problem:** ${report.problemLabel}`,`**Reporter:** ${report.reporter_global_name||report.reporter_id}`,`**Status:** ${report.status}`,
    report.explanation?`\n**Explanation**\n${report.explanation}`:''
  ].join('\n').slice(0,4096));
  return {embeds:[embed],components:buttonRows([
    {customId:`hu:report:markreviewing:${report.id}`,label:'Mark Reviewing',style:'primary'},
    {customId:`hu:report:resolve:${report.id}`,label:'Resolve',style:'success'},
    {customId:`hu:report:dismiss:${report.id}`,label:'Dismiss',style:'secondary'},
    {customId:'hu:admin:reports',label:'Back',style:'secondary'}
  ])};
}
