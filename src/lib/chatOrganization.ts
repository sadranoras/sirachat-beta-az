import { supabase } from './supabase'

export async function listChatFolders(userId: string) {
  const { data, error } = await supabase.from('chat_folders')
    .select('*').eq('user_id', userId).order('position')
  if (error) throw error
  return data || []
}

export async function createChatFolder(userId: string, name: string) {
  const { data, error } = await supabase.from('chat_folders')
    .insert({ user_id: userId, name, position: 0 }).select().single()
  if (error) throw error
  return data
}

export async function addChatToFolder(userId: string, folderId: string, chatId: string) {
  const { error } = await supabase.from('chat_folder_items')
    .upsert({ user_id: userId, folder_id: folderId, chat_id: chatId })
  if (error) throw error
}

export async function removeChatFromFolder(userId: string, folderId: string, chatId: string) {
  const { error } = await supabase.from('chat_folder_items')
    .delete().eq('user_id', userId).eq('folder_id', folderId).eq('chat_id', chatId)
  if (error) throw error
}

export async function archiveChat(userId: string, chatId: string, archived = true) {
  const { error } = await supabase.from('chat_user_settings')
    .upsert({ user_id: userId, chat_id: chatId, archived })
  if (error) throw error
}

export async function blockUser(userId: string, blockedUserId: string) {
  const { error } = await supabase.from('blocked_users')
    .upsert({ user_id: userId, blocked_user_id: blockedUserId })
  if (error) throw error
}

export async function unblockUser(userId: string, blockedUserId: string) {
  const { error } = await supabase.from('blocked_users')
    .delete().eq('user_id', userId).eq('blocked_user_id', blockedUserId)
  if (error) throw error
}
