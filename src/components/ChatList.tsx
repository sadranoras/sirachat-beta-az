import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Chat, Profile } from '../lib/types'
import { Plus, Search, Settings, Trash2, Shield, Download, Hash, Users, Bookmark, MoreVertical, Archive, Folder, FolderPlus, X, Check, Ban } from 'lucide-react'
import Avatar from './Avatar'
import InstallModal from './InstallModal'

interface ChatListProps { selectedId:string; onSelect:(id:string)=>void; onNewChat:()=>void; onSettings:()=>void; onAdmin:()=>void; onPreviewChat:(id:string)=>void }
interface ChatWithMeta extends Chat { other_user?:Profile|null; last_message?:string|null; last_message_time?:string|null; other_online?:boolean }
interface FolderDef { id:string; name:string; chats:string[] }

const KEY=(uid:string)=>`sirachat-folders-${uid}`
const ARCH=(uid:string)=>`sirachat-archived-${uid}`
const BLOCK=(uid:string)=>`sirachat-blocked-${uid}`

export default function ChatList({selectedId,onSelect,onNewChat,onSettings,onAdmin,onPreviewChat}:ChatListProps){
 const {user,profile}=useAuth()
 const [chats,setChats]=useState<ChatWithMeta[]>([]),[search,setSearch]=useState(''),[loading,setLoading]=useState(true)
 const [menuChatId,setMenuChatId]=useState<string|null>(null),[showInstall,setShowInstall]=useState(false),[unreadCounts,setUnreadCounts]=useState<Record<string,number>>({})
 const [publicResults,setPublicResults]=useState<Chat[]>([]),[searchingPublic,setSearchingPublic]=useState(false)
 const [folders,setFolders]=useState<FolderDef[]>([]),[activeFolder,setActiveFolder]=useState('all'),[selected,setSelected]=useState<Set<string>>(new Set()),[newFolder,setNewFolder]=useState(''),[showFolderCreator,setShowFolderCreator]=useState(false),[archived,setArchived]=useState<string[]>([]),[dragFolderId,setDragFolderId]=useState<string|null>(null)
 const press=useRef<ReturnType<typeof setTimeout>|null>(null),longPressed=useRef(false)

 const persist=()=>{if(!user)return;localStorage.setItem(KEY(user.id),JSON.stringify(folders));localStorage.setItem(ARCH(user.id),JSON.stringify(archived))}
 useEffect(()=>{if(!user)return;const load=()=>{try{setFolders(JSON.parse(localStorage.getItem(KEY(user.id))||'[]'));setArchived(JSON.parse(localStorage.getItem(ARCH(user.id))||'[]'))}catch{}};load();window.addEventListener('chat-folders-updated',load);return()=>window.removeEventListener('chat-folders-updated',load)},[user?.id])

 const loadChats=useCallback(async()=>{
  if(!user)return
  const {data:members}=await supabase.from('chat_members').select('chat_id').eq('user_id',user.id)
  const ids=(members||[]).map((m:any)=>m.chat_id); if(!ids.length){setChats([]);setLoading(false);return}
  const {data:cs}=await supabase.from('chats').select('*').in('id',ids)
  const result:any[]=[]
  for(const c of cs||[]){
   if(c.type==='saved'){result.push({...c,title:'پیام‌های ذخیره شده'});continue}
   let item:any={...c}
   if(c.type==='direct'){
    const {data:cm}=await supabase.from('chat_members').select('user_id').eq('chat_id',c.id).neq('user_id',user.id).limit(1)
    const oid=cm?.[0]?.user_id
    if(oid){const {data:p}=await supabase.from('profiles').select('*').eq('id',oid).single();item.other_user=p||null;item.title=p?.display_name||p?.username||'گفت‌وگو';item.avatar_url=p?.avatar_url||null;item.other_online=!!p?.is_online}
   }
   result.push(item)
  }
  const {data:msgs}=await supabase.from('messages').select('chat_id,content,created_at,deleted_at,message_type,file_name').in('chat_id',ids).order('created_at',{ascending:false}).limit(100)
  for(const m of msgs||[]){const c=result.find(x=>x.id===m.chat_id);if(c&&!c.last_message_time){c.last_message_time=m.created_at;c.last_message=m.deleted_at?'پیام حذف شد':m.message_type==='image'?'📷 تصویر':m.message_type==='voice'?'🎤 ویس':m.message_type==='file'?'📎 فایل':m.content}}
  result.sort((a,b)=>{if(a.type==='saved')return -1;if(b.type==='saved')return 1;return new Date(b.last_message_time||b.created_at).getTime()-new Date(a.last_message_time||a.created_at).getTime()})
  setChats(result);setLoading(false)
 },[user])
 const loadUnread=useCallback(async()=>{if(!user)return;const {data:m}=await supabase.from('chat_members').select('chat_id').eq('user_id',user.id);const ids=(m||[]).map((x:any)=>x.chat_id);if(!ids.length){setUnreadCounts({});return};const {data:ms}=await supabase.from('messages').select('chat_id').in('chat_id',ids).neq('sender_id',user.id).is('read_at',null).is('deleted_at',null);const c:Record<string,number>={};for(const x of ms||[])c[x.chat_id]=(c[x.chat_id]||0)+1;setUnreadCounts(c)},[user])
 useEffect(()=>{loadChats();loadUnread()},[loadChats,loadUnread])
 useEffect(()=>{const ch=supabase.channel('chat_list_updates').on('postgres_changes',{event:'*',schema:'public',table:'chat_members'},()=>{loadChats();loadUnread()}).on('postgres_changes',{event:'*',schema:'public',table:'chats'},loadChats).on('postgres_changes',{event:'*',schema:'public',table:'messages'},()=>{loadChats();loadUnread()}).subscribe();const h=()=>{loadChats();loadUnread()};window.addEventListener('chat-list-reload',h);return()=>{supabase.removeChannel(ch);window.removeEventListener('chat-list-reload',h)}},[loadChats,loadUnread])

 useEffect(()=>{if(!user||!search.trim()){setPublicResults([]);return}const q=search.trim().toLowerCase();setSearchingPublic(true);const t=setTimeout(async()=>{const {data:mc}=await supabase.from('chat_members').select('chat_id').eq('user_id',user.id);const mine=new Set((mc||[]).map((x:any)=>x.chat_id));const {data:pc}=await supabase.from('chats').select('*').in('type',['group','channel']).eq('is_private',false).or(`title.ilike.%${q}%,username.ilike.%${q}%`).limit(20);setPublicResults((pc||[]).filter((x:any)=>!mine.has(x.id)) as Chat[]);setSearchingPublic(false)},300);return()=>clearTimeout(t)},[search,user])

 const saveFolders=(f:FolderDef[])=>{setFolders(f);if(user){localStorage.setItem(KEY(user.id),JSON.stringify(f));window.dispatchEvent(new Event('chat-folders-updated'))}}
 const toggleArchive=(id:string)=>{const n=archived.includes(id)?archived.filter(x=>x!==id):[...archived,id];setArchived(n);if(user)localStorage.setItem(ARCH(user.id),JSON.stringify(n));setMenuChatId(null)}
 const addFolder=(id:string,fid:string)=>{saveFolders(folders.map(f=>f.id===fid&&!f.chats.includes(id)?{...f,chats:[...f.chats,id]}:f));setMenuChatId(null)}
 const removeFromFolder=(id:string,fid=activeFolder)=>{saveFolders(folders.map(f=>f.id===fid?{...f,chats:f.chats.filter(x=>x!==id)}:f));setMenuChatId(null)}
 const createFolder=()=>{const n=newFolder.trim();if(!n)return;saveFolders([...folders,{id:crypto.randomUUID(),name:n,chats:[]}]);setNewFolder('');setShowFolderCreator(false)}
 const folderHold=useRef<ReturnType<typeof setTimeout>|null>(null)
 const startFolderHold=(id:string)=>{if(folderHold.current)clearTimeout(folderHold.current);folderHold.current=setTimeout(()=>setDragFolderId(id),450)}
 const endFolderHold=()=>{if(folderHold.current)clearTimeout(folderHold.current);folderHold.current=null;setDragFolderId(null)}
 const moveFolder=(overIndex:number)=>{if(!dragFolderId)return;const from=folders.findIndex(f=>f.id===dragFolderId);if(from<0||from===overIndex)return;const next=[...folders];const [item]=next.splice(from,1);next.splice(overIndex,0,item);saveFolders(next)}
 const deleteFolder=(fid:string)=>{saveFolders(folders.filter(f=>f.id!==fid));if(activeFolder===fid)setActiveFolder('all')}
 const deleteChat=async(id:string,owner:boolean)=>{if(!user)return;if(owner){await supabase.from('chat_members').delete().eq('chat_id',id);await supabase.from('chats').delete().eq('id',id)}else await supabase.from('chat_members').delete().eq('chat_id',id).eq('user_id',user.id);setSelected(new Set());setMenuChatId(null);setChats(p=>p.filter(c=>c.id!==id));if(selectedId===id)onSelect('')}
 const block=async(chat:ChatWithMeta)=>{if(!user||!chat.other_user)return;const key=BLOCK(user.id);const arr=JSON.parse(localStorage.getItem(key)||'[]');if(!arr.includes(chat.other_user.id))arr.push(chat.other_user.id);localStorage.setItem(key,JSON.stringify(arr));setMenuChatId(null)}
 const startPress=(id:string)=>{longPressed.current=false;press.current=setTimeout(()=>{longPressed.current=true;setSelected(p=>new Set(p).add(id))},500)}
 const cancelPress=()=>{if(press.current){clearTimeout(press.current);press.current=null}}
 const onRowClick=(id:string,saved:boolean)=>{if(longPressed.current){longPressed.current=false;return}if(selected.size){setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n})}else onSelect(id)}
 const removeSelected=async()=>{for(const id of selected){const c=chats.find(x=>x.id===id);if(c)await deleteChat(id,c.created_by===user?.id)}setSelected(new Set())}
 const filtered=chats.filter(c=>{const title=(c.title||c.other_user?.display_name||'').toLowerCase();const q=search.toLowerCase();if(!title.includes(q)&&!(c.other_user?.username||'').toLowerCase().includes(q))return false;if(activeFolder==='archived')return archived.includes(c.id);if(activeFolder==='all')return !archived.includes(c.id)||c.type==='saved';return folders.find(f=>f.id===activeFolder)?.chats.includes(c.id)||false})

 return <div className="w-full md:w-80 md:max-w-80 h-full bg-tg-panel flex flex-col border-l border-tg-border relative" onClick={()=>menuChatId&&setMenuChatId(null)}>
  <div className="flex items-center gap-2 p-3"><h1 className="text-lg font-bold text-tg-text flex-1">سیرا چت</h1>{profile?.is_admin&&<button onClick={(e)=>{e.stopPropagation();onAdmin()}} aria-label="پنل مدیریت" className="w-9 h-9 rounded-full hover:bg-tg-hover flex items-center justify-center text-tg-accent"><Shield size={20}/></button>}<button onClick={()=>setShowInstall(true)} className="w-9 h-9 rounded-full hover:bg-tg-hover flex items-center justify-center text-tg-subtext"><Download size={20}/></button><button onClick={onSettings} className="w-9 h-9 rounded-full hover:bg-tg-hover flex items-center justify-center text-tg-subtext"><Settings size={20}/></button></div>
  <div className="px-3 pb-2"><div className="relative"><Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-tg-subtext"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جستجو..." className="w-full bg-tg-hover rounded-xl pr-10 pl-4 py-2 text-tg-text outline-none text-sm"/></div></div>
  <div className="px-2 pb-2 flex gap-1 overflow-x-auto"><button onClick={()=>setActiveFolder('all')} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs ${activeFolder==='all'?'bg-tg-accent text-white':'bg-tg-hover text-tg-subtext'}`}>همه گفتگوها</button><button onClick={()=>setActiveFolder('archived')} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 ${activeFolder==='archived'?'bg-tg-accent text-white':'bg-tg-hover text-tg-subtext'}`}><Archive size={13}/>بایگانی</button>{folders.map((f,fi)=><div key={f.id} className={`flex shrink-0 ${dragFolderId===f.id?'opacity-50':''}`} onPointerDown={()=>startFolderHold(f.id)} onPointerMove={()=>moveFolder(fi)} onPointerUp={endFolderHold} onPointerCancel={endFolderHold}><button onClick={()=>setActiveFolder(f.id)} className={`px-3 py-1.5 rounded-lg text-xs ${activeFolder===f.id?'bg-tg-accent text-white':'bg-tg-hover text-tg-subtext'}`}><Folder size={13} className="inline ml-1"/>{f.name}</button></div>)}<button onClick={()=>setShowFolderCreator(true)} className="shrink-0 w-8 rounded-lg bg-tg-hover flex items-center justify-center text-tg-subtext"><FolderPlus size={15}/></button></div>
  {selected.size>0&&<div className="px-3 py-2 bg-tg-active flex items-center gap-2"><span className="flex-1 text-sm text-tg-text">{selected.size} انتخاب</span><button onClick={removeSelected} className="w-9 h-9 flex items-center justify-center text-tg-red"><Trash2 size={18}/></button><button onClick={()=>setSelected(new Set())} className="w-9 h-9 flex items-center justify-center text-tg-text"><X size={19}/></button></div>}
  <div className="flex-1 overflow-y-auto">{loading?<p className="text-center text-tg-subtext p-4">در حال بارگذاری...</p>:filtered.map(chat=>{const saved=chat.type==='saved',title=saved?'پیام‌های ذخیره شده':chat.title||'گفت‌وگو',online=!!chat.other_online;return <div key={chat.id} onPointerDown={()=>!saved&&startPress(chat.id)} onPointerUp={cancelPress} onPointerLeave={cancelPress} onClick={e=>{e.stopPropagation();onRowClick(chat.id,saved)}} className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer relative ${selectedId===chat.id?'bg-tg-active':'hover:bg-tg-hover'} ${selected.has(chat.id)?'ring-2 ring-tg-accent':''}`}>
    <div className="relative shrink-0">{saved?<div className="w-12 h-12 rounded-full bg-tg-accent/20 flex items-center justify-center"><Bookmark size={24} className="text-tg-accent"/></div>:<><Avatar url={chat.avatar_url} name={title} size={48}/>{chat.type==='direct'&&<div className={`absolute bottom-0 left-0 w-3.5 h-3.5 rounded-full border-2 border-tg-panel ${online?'bg-tg-green':'bg-tg-subtext'}`}/>}</>}</div>
    <div className="flex-1 min-w-0 text-right"><p className="text-tg-text font-medium truncate">{title}</p><p className={`text-sm truncate ${online?'text-tg-green':'text-tg-subtext'}`}>{chat.last_message||(online?'آنلاین':chat.type==='group'?'گروه':chat.type==='channel'?'کانال':'گفت‌وگو')}</p></div>
    <div className="flex flex-col items-end">{chat.last_message_time&&<span className="text-tg-subtext text-xs">{new Date(chat.last_message_time).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})}</span>}{unreadCounts[chat.id]>0&&<span className="bg-tg-accent text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center">{unreadCounts[chat.id]}</span>}</div>
    {!saved&&<button type="button" onClick={e=>{e.stopPropagation();setMenuChatId(menuChatId===chat.id?null:chat.id)}} className="w-8 h-8 rounded-full hover:bg-tg-active flex items-center justify-center text-tg-subtext"><MoreVertical size={17}/></button>}
    {menuChatId===chat.id&&!saved&&<div className="absolute top-full left-2 z-[100] min-w-[200px] bg-tg-panel rounded-xl shadow-2xl border border-tg-hover py-1" onClick={e=>e.stopPropagation()}>
      <button onClick={()=>toggleArchive(chat.id)} className="w-full flex gap-2 px-4 py-2 text-sm text-tg-text hover:bg-tg-hover"><Archive size={16}/>{archived.includes(chat.id)?'خارج کردن از بایگانی':'بایگانی'}</button>
      {folders.map(f=><button key={f.id} onClick={()=>activeFolder===f.id?removeFromFolder(chat.id,f.id):addFolder(chat.id,f.id)} className="w-full flex gap-2 px-4 py-2 text-sm text-tg-text hover:bg-tg-hover"><Folder size={15}/>{f.chats.includes(chat.id)?'حذف از ': 'افزودن به '}{f.name}</button>)}
      <button onClick={()=>setSelected(new Set([chat.id]))} className="w-full flex gap-2 px-4 py-2 text-sm text-tg-text hover:bg-tg-hover"><Check size={16}/>انتخاب</button>
      {chat.type==='direct'&&<button onClick={()=>block(chat)} className="w-full flex gap-2 px-4 py-2 text-sm text-tg-red hover:bg-tg-hover"><Ban size={16}/>مسدود کردن</button>}
      <button onClick={()=>deleteChat(chat.id,chat.created_by===user?.id)} className="w-full flex gap-2 px-4 py-2 text-sm text-tg-red hover:bg-tg-hover"><Trash2 size={16}/>حذف گفت‌وگو</button>
    </div>}
  </div>})}{searchingPublic&&<p className="text-center text-tg-subtext text-sm p-4">در حال جست‌وجو...</p>}{publicResults.map(c=><div key={c.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-tg-hover" onClick={()=>onPreviewChat(c.id)}><Avatar url={c.avatar_url} name={c.title||'گروه'} size={48}/><div className="flex-1"><p className="text-tg-text">{c.title||'گروه'}</p><p className="text-tg-subtext text-xs">{c.type==='channel'?'کانال عمومی':'گروه عمومی'}</p></div></div>)}</div>
  <button onClick={onNewChat} className="absolute bottom-4 left-4 w-14 h-14 rounded-full bg-tg-accent flex items-center justify-center shadow-lg"><Plus size={24} className="text-white"/></button>
  <InstallModal open={showInstall} onClose={()=>setShowInstall(false)}/>
  {showFolderCreator&&<div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={()=>setShowFolderCreator(false)}><div className="bg-tg-panel rounded-2xl p-5 w-full max-w-sm" onClick={e=>e.stopPropagation()}><h3 className="text-tg-text font-bold mb-3">پوشه جدید</h3><input autoFocus value={newFolder} onChange={e=>setNewFolder(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createFolder()} className="w-full bg-tg-hover rounded-xl px-3 py-2 text-tg-text outline-none"/><div className="flex gap-2 mt-3"><button onClick={createFolder} className="flex-1 bg-tg-accent text-white rounded-xl py-2">ساختن</button><button onClick={()=>setShowFolderCreator(false)} className="flex-1 bg-tg-hover text-tg-text rounded-xl py-2">لغو</button></div></div></div>}
 </div>
}
