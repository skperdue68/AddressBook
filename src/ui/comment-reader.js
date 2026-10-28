import { EmbedBuilder, escapeMarkdown, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { buttonRows } from './housing-ui.js';

export const commentPageSize = 2;

function commentTimestamp(value) {
  const date = value instanceof Date ? value : new Date(/(?:Z|[+-]\d\d:?\d\d)$/.test(String(value)) ? String(value) : `${value}Z`);
  return Math.floor(date.getTime() / 1000);
}

export function commentReaderPayload({ house, rows, total, page, token, backId }) {
  const pages = Math.max(1, Math.ceil(total / commentPageSize));
  const title = `💬 Comments — ${house.display_name || house.house_name || house.name || 'House'}`;
  const header = new EmbedBuilder().setColor(0xe9be72).setTitle(title.slice(0, 256)).setDescription(
    `ESO owner: @${String(house.eso_owner || '').replace(/^@/, '')}\n\n` +
    'Comments apply to this ESO destination and may also appear through other saved entries for the same house.\n\n' +
    `**Page ${page} of ${pages} · ${total} comments · Newest first**` +
    (rows.length ? '' : '\n\nNo comments yet. Share a favorite detail or leave a thank-you.')
  );
  const embeds = [header, ...rows.map(row => {
    const timestamp = commentTimestamp(row.created_at);
    const author = escapeMarkdown(String(row.author_name || row.discord_user_id || 'Author unavailable').slice(0, 80));
    return new EmbedBuilder().setColor(0x415978).setDescription(
      `**${author}**${Number.isFinite(timestamp) ? ` — <t:${timestamp}:f>` : ''}\n${String(row.comment_text || '').slice(0, 2000)}`
    );
  })];
  const move = (label, to) => ({ customId: `hu:discussion:page:${token}:${to}`, label, style: 'secondary' });
  const navigation = [];
  if (page > 1) navigation.push(move('First', 1), move('Previous', page - 1));
  if (page < pages) navigation.push(move('Next', page + 1), move('Last', pages));
  if (pages > 2) navigation.push({ customId: `hu:discussion:jump:${token}`, label: 'Jump to page', style: 'secondary' });
  return {
    embeds,
    components: [
      ...buttonRows([
        { customId: `hu:discussion:add:${token}`, label: 'Add Comment', style: 'primary' },
        { customId: backId, label: backId.startsWith('tour:') || backId.startsWith('hu:progress:') ? 'Back to tour' : 'Back to house', style: 'secondary' }
      ]),
      ...buttonRows(navigation)
    ]
  };
}

export function commentPageModal(token, pages) {
  return new ModalBuilder().setCustomId(`hu:modal:discussionpage:${token}`).setTitle('Jump to comments page').addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('page').setLabel(`Page number (1 to ${pages})`).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)
    )
  );
}
