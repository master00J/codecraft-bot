/**
 * Guild command permissions: restrict slash commands to certain roles.
 * Reads guild_command_permissions; empty allowed_role_ids = everyone. Non-empty = only those roles (and Administrator) can use the command.
 */

const { PermissionFlagsBits } = require('discord.js');
const { getSupabase } = require('../supabase-client');

const RESTRICTABLE_COMMAND_NAMES = ['store', 'shop', 'buy', 'sell', 'application', 'ticket', 'redeem'];

/**
 * Check if the member is allowed to use this command. If not, replies ephemerally and returns false.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} commandName
 * @returns {Promise<boolean>} true if allowed to proceed, false if blocked (reply already sent)
 */
async function checkCommandPermission(interaction, commandName) {
  if (!RESTRICTABLE_COMMAND_NAMES.includes(commandName)) return true;
  const guildId = interaction.guild?.id;
  if (!guildId) return true;

  const supabase = getSupabase();
  if (!supabase) return true;

  const { data: row, error } = await supabase
    .from('guild_command_permissions')
    .select('allowed_role_ids')
    .eq('guild_id', guildId)
    .eq('command_name', commandName)
    .maybeSingle();

  if (error) {
    console.error('[CommandPermissions] DB error:', error.message);
    return true;
  }

  const allowedRoleIds = row?.allowed_role_ids;
  if (!Array.isArray(allowedRoleIds) || allowedRoleIds.length === 0) return true;

  const member = interaction.member;
  if (!member || typeof member.permissions?.has !== 'function') {
    await interaction.reply({
      content: 'You don\'t have permission to use this command here.',
      ephemeral: true
    }).catch(() => {});
    return false;
  }

  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  const memberRoles = member.roles?.cache;
  if (!memberRoles) {
    await interaction.reply({
      content: 'You don\'t have permission to use this command here.',
      ephemeral: true
    }).catch(() => {});
    return false;
  }

  const hasRole = allowedRoleIds.some(roleId => memberRoles.has(roleId));
  if (hasRole) return true;

  await interaction.reply({
    content: 'You don\'t have permission to use this command. Only certain roles (or server admins) can use it.',
    ephemeral: true
  }).catch(() => {});
  return false;
}

module.exports = {
  RESTRICTABLE_COMMAND_NAMES,
  checkCommandPermission
};
