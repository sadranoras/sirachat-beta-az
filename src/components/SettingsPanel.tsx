import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { subscribeToPush } from '../lib/push'
import { X, Camera, LogOut, Phone, Eye, EyeOff, Lock, Loader2, CheckCircle2, Pencil, AtSign, Info, HardDrive, ChevronLeft, Bookmark, Bell, BellOff, Image as ImageIcon, RotateCcw, Folder, FolderPlus, Trash2 } from 'lucide-react'
import Avatar from './Avatar'
import DownloadFolderSection from './DownloadFolderSection'
import DownloadedFilesManager from './DownloadedFilesManager'

interface SettingsPanelProps { onClose: () => void; onOpenSavedMessages?: () => void }

export default function SettingsPanel({ onClose, onOpenSavedMessages }: SettingsPanelProps) {
  const { user, profile, signOut, updateProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  type FolderDef = { id: string; name: string; chats: string[] }
  const folderKey = (uid: string) => `sirachat-folders-${uid}`
  const [chatFolders, setChatFolders] = useState<FolderDef[]>([])
  const [newFolderName, setNewFolderName] = useState('')
  const [showFolderManager, setShowFolderManager] = useState(false)

  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [phoneVisible, setPhoneVisible] = useState(profile?.phone_visible ?? true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameChecking, setUsernameChecking] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const backgroundInputRef = useRef<HTMLInputElement>(null)
  const [chatBackground, setChatBackground] = useState(() => localStorage.getItem('sira-chat-background') || '')
  const presetBackgrounds = [
    ['linear-gradient(135deg,#0f172a,#164e63)', 'اقیانوس شب'],
    ['linear-gradient(135deg,#111827,#312e81)', 'نیمه‌شب بنفش'],
    ['linear-gradient(135deg,#052e16,#134e4a)', 'جنگل'],
    ['linear-gradient(135deg,#3b0764,#1e1b4b)', 'کهکشانی'],
    ['linear-gradient(135deg,#172554,#0f766e)', 'آبی آرام'],
    ['linear-gradient(135deg,#451a03,#7c2d12)', 'غروب'],
    ['linear-gradient(135deg,#1f2937,#334155)', 'خاکستری مدرن'],
    ['linear-gradient(135deg,#082f49,#155e75)', 'آبی عمیق'],
    ['linear-gradient(135deg,#312e81,#701a75)', 'نئونی'],
    ['linear-gradient(135deg,#3f6212,#166534)', 'سبز شب'],
    ['radial-gradient(circle at 50% 50%,rgba(59,130,246,.45),transparent 35%),linear-gradient(135deg,#020617,#111827)', 'حرکت موس دسکتاپ'],
  ]
  const setBackground = (value: string) => {
    setChatBackground(value)
    localStorage.setItem('sira-chat-background', value)
    window.dispatchEvent(new CustomEvent('sira-background-changed'))
  }


  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotifEnabled(Notification.permission === 'granted')
    }
  }, [])

  const handleToggleNotifications = async () => {
    if (!user) return
    setNotifLoading(true)
    try {
      if (notifEnabled) {
        const reg = await navigator.serviceWorker?.ready
        const sub = await reg?.pushManager.getSubscription()
        if (sub) { await sub.unsubscribe(); const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', sub.endpoint); if (error) console.error('Failed to remove push subscription:', error) }
        setNotifEnabled(false)
      } else {
        const ok = await subscribeToPush(user.id)
        setNotifEnabled(ok)
      }
    } catch (e) { console.error('Notification toggle failed:', e) }
    setNotifLoading(false)
  }

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const ext = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file)
    if (uploadError) return
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
    await updateProfile({ avatar_url: urlData.publicUrl })
  }

  const checkUsernameUnique = async (value: string): Promise<string | null> => {
    const clean = value.trim().toLowerCase()
    if (!clean) return null
    if (!/^[a-z0-9_]{3,32}$/.test(clean)) return 'فقط حروف انگلیسی، عدد و زیرخط (۳ تا ۳۲ کاراکتر)'
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', clean)
      .neq('id', user?.id || '')
      .maybeSingle()
    if (error) return 'بررسی نام کاربری ناموفق بود'
    if (data) return 'این نام کاربری قبلاً گرفته شده'
    const { data: chatData } = await supabase
      .from('chats')
      .select('id')
      .eq('username', clean)
      .maybeSingle()
    if (chatData) return 'این نام کاربری برای یک کانال یا گروه استفاده شده است'
    return null
  }

  const handleUsernameChange = async (value: string) => {
    setUsername(value)
    setUsernameError(null)
    if (!value.trim()) return
    setUsernameChecking(true)
    const err = await checkUsernameUnique(value)
    setUsernameChecking(false)
    setUsernameError(err)
  }

  const enterEdit = () => {
    setDisplayName(profile?.display_name || '')
    setUsername(profile?.username || '')
    setBio(profile?.bio || '')
    setPhone(profile?.phone || '')
    setPhoneVisible(profile?.phone_visible ?? true)
    setUsernameError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setUsernameError(null)
  }

  const handleSave = async () => {
    if (username.trim()) {
      const err = await checkUsernameUnique(username)
      if (err) { setUsernameError(err); return }
    }
    if (!displayName.trim()) {
      setUsernameError('نام نمایشی نمی‌تواند خالی باشد')
      return
    }
    const trimmedPhone = phone.trim()
    if (!trimmedPhone && !profile?.is_admin) {
      setUsernameError('خالی کردن شماره تلفن فقط برای مدیران ممکن است')
      return
    }
    if (trimmedPhone && trimmedPhone !== (profile?.phone || '')) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', trimmedPhone)
        .neq('id', user?.id || '')
        .maybeSingle()
      if (existing) {
        setUsernameError('این شماره تلفن قبلاً توسط حساب دیگری ثبت شده است')
        return
      }
    }
    setSaving(true)
    const result = await updateProfile({
      display_name: displayName.trim(),
      username: username.trim().toLowerCase() || null,
      bio: bio.trim() || null,
      phone: trimmedPhone,
      phone_visible: phoneVisible,
    })
    setSaving(false)
    if (result.error) {
      setUsernameError(`ذخیره تغییرات ناموفق بود: ${result.error}`)
      return
    }
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleChangePassword = async () => {
    setPwError(null)
    setPwSuccess(false)
    if (!oldPassword || !newPassword || !confirmPassword) { setPwError('همه فیلدها را پر کنید'); return }
    if (newPassword.length < 6) { setPwError('رمز جدید باید حداقل ۶ کاراکتر باشد'); return }
    if (newPassword !== confirmPassword) { setPwError('رمز جدید و تکرار آن یکسان نیستند'); return }
    setPwLoading(true)
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user?.email || '', password: oldPassword })
    if (verifyError) { setPwLoading(false); setPwError('رمز فعلی اشتباه است'); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwLoading(false)
    if (error) { setPwError(error.message); return }
    setOldPassword(''); setNewPassword(''); setConfirmPassword('')
    setPwSuccess(true)
    setTimeout(() => setPwSuccess(false), 3000)
  }

  useEffect(() => {
    if (!user) return
    try { setChatFolders(JSON.parse(localStorage.getItem(folderKey(user.id)) || '[]')) } catch { setChatFolders([]) }
    const sync = () => { try { setChatFolders(JSON.parse(localStorage.getItem(folderKey(user.id)) || '[]')) } catch {} }
    window.addEventListener('chat-folders-updated', sync)
    return () => window.removeEventListener('chat-folders-updated', sync)
  }, [user?.id])

  const persistChatFolders = (next: FolderDef[]) => {
    setChatFolders(next)
    if (user) {
      localStorage.setItem(folderKey(user.id), JSON.stringify(next))
      window.dispatchEvent(new Event('chat-folders-updated'))
    }
  }
  const createChatFolder = () => {
    const name = newFolderName.trim()
    if (!name) return
    persistChatFolders([...chatFolders, { id: crypto.randomUUID(), name, chats: [] }])
    setNewFolderName('')
  }
  const removeChatFolder = (id: string) => { if (id === 'all') return; persistChatFolders(chatFolders.filter(f => f.id !== id)) }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-tg-panel rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          {editing ? (
            <button onClick={cancelEdit} className="text-tg-subtext hover:text-tg-text flex items-center gap-1 text-sm">
              <ChevronLeft size={18} /> انصراف
            </button>
          ) : (
            <h2 className="text-lg font-bold text-tg-text">تنظیمات</h2>
          )}
          <button onClick={onClose} className="text-tg-subtext hover:text-tg-text"><X size={20} /></button>
        </div>

        {saved && (
          <div className="mb-4 rounded-xl bg-tg-green/15 border border-tg-green/40 px-4 py-2.5 text-center text-tg-green text-sm flex items-center justify-center gap-1.5">
            <CheckCircle2 size={16} /> ذخیره شد
          </div>
        )}

        {/* Profile header */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <Avatar url={profile?.avatar_url} name={profile?.display_name || profile?.username || ''} size={88} />
            {editing && (
              <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 left-0 w-7 h-7 rounded-full bg-tg-accent flex items-center justify-center border-2 border-tg-panel">
                <Camera size={14} className="text-white" />
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          </div>
          <p className="text-tg-text font-medium mt-2 text-lg">{profile?.display_name || 'بدون نام'}</p>
          {profile?.username ? (
            <p className="text-tg-accent text-sm" dir="ltr">@{profile.username}</p>
          ) : (
            <p className="text-tg-subtext text-xs mt-1">هنوز نام کاربری انتخاب نکرده‌اید</p>
          )}
        </div>

        {editing ? (
          /* ---- Edit mode ---- */
          <div className="space-y-4">
            <div>
              <label className="text-tg-subtext text-sm mb-1 block">نام نمایشی</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="نام شما" className="w-full bg-tg-hover rounded-xl px-4 py-2.5 text-tg-text placeholder-tg-subtext outline-none focus:ring-2 ring-tg-accent" dir="rtl" />
            </div>
            <div>
              <label className="text-tg-subtext text-sm mb-1 block">نام کاربری (آیدی)</label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tg-subtext">@</span>
                <input type="text" value={username} onChange={e => handleUsernameChange(e.target.value)} placeholder="username" dir="ltr" className="w-full bg-tg-hover rounded-xl pr-7 pl-4 py-2.5 text-tg-text placeholder-tg-subtext outline-none focus:ring-2 ring-tg-accent" />
                {usernameChecking && <Loader2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tg-subtext animate-spin" />}
              </div>
              {usernameError ? (
                <p className="text-tg-red text-xs mt-1">{usernameError}</p>
              ) : (
                <p className="text-tg-subtext text-xs mt-1">حروف انگلیسی، عدد و زیرخط · حداقل ۳ کاراکتر</p>
              )}
            </div>
            <div>
              <label className="text-tg-subtext text-sm mb-1 block">درباره</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="چند کلمه درباره خودتان..." rows={3} className="w-full bg-tg-hover rounded-xl px-4 py-2.5 text-tg-text placeholder-tg-subtext outline-none focus:ring-2 ring-tg-accent resize-none" dir="rtl" />
            </div>
            <div>
              <label className="text-tg-subtext text-sm mb-1 block">شماره تلفن</label>
              <div className="flex gap-2">
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="شماره تلفن" className="flex-1 bg-tg-hover rounded-xl px-4 py-2.5 text-tg-text placeholder-tg-subtext outline-none focus:ring-2 ring-tg-accent" dir="ltr" />
                <button onClick={() => setPhoneVisible(!phoneVisible)} className={`px-3 rounded-xl flex items-center justify-center gap-1.5 text-sm transition-colors ${phoneVisible ? 'bg-tg-hover text-tg-subtext' : 'bg-tg-accent/20 text-tg-accent'}`}>
                  {phoneVisible ? <><Eye size={16} /> عمومی</> : <><EyeOff size={16} /> مخفی</>}
                </button>
              </div>
              <p className="text-tg-subtext text-xs mt-1">{phoneVisible ? 'شماره شما برای دیگران قابل مشاهده است' : 'شماره شما از دیگران مخفی است'}</p>
            </div>
            <button onClick={handleSave} disabled={saving || !!usernameError || usernameChecking} className="w-full bg-tg-accent hover:bg-tg-accent2 text-white font-semibold rounded-xl py-3 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {saving ? '...' : 'ذخیره تغییرات'}
            </button>
          </div>
        ) : (
          /* ---- View mode (info first) ---- */
          <>
            <div className="space-y-1 mb-5">
              {profile?.bio && (
                <div className="flex items-start gap-3 px-3 py-3 rounded-xl bg-tg-hover/40">
                  <Info size={20} className="text-tg-subtext flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-tg-text text-sm leading-relaxed">{profile.bio}</p>
                    <p className="text-tg-subtext text-xs mt-0.5">درباره</p>
                  </div>
                </div>
              )}
              {profile?.username && (
                <div
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-tg-hover/40 hover:bg-tg-hover transition-colors text-right"
                >
                  <AtSign size={20} className="text-tg-subtext flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-tg-text text-sm" dir="ltr">@{profile.username}</p>
                    <p className="text-tg-subtext text-xs mt-0.5">نام کاربری</p>
                  </div>
                </div>
              )}
              {!profile?.username && (
                <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-tg-hover/40">
                  <AtSign size={20} className="text-tg-subtext flex-shrink-0" />
                  <div>
                    <p className="text-tg-text text-sm" dir="ltr">{profile?.username ? `@${profile.username}` : '—'}</p>
                    <p className="text-tg-subtext text-xs mt-0.5">نام کاربری</p>
                  </div>
                </div>
              )}
              {profile?.phone && (
                <div
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-tg-hover/40 hover:bg-tg-hover transition-colors text-right"
                >
                  <Phone size={20} className="text-tg-subtext flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-tg-text text-sm" dir="ltr">{profile.phone}</p>
                    <p className="text-tg-subtext text-xs mt-0.5">شماره تلفن{!profile.phone_visible ? ' (مخفی)' : ''}</p>
                  </div>
                </div>
              )}
              {!profile?.phone && (
                <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-tg-hover/40">
                  <Phone size={20} className="text-tg-subtext flex-shrink-0" />
                  <div>
                    <p className="text-tg-text text-sm" dir="ltr">{profile?.phone || '—'}</p>
                    <p className="text-tg-subtext text-xs mt-0.5">شماره تلفن{!profile?.phone_visible ? ' (مخفی)' : ''}</p>
                  </div>
                </div>
              )}
            </div>
            {onOpenSavedMessages && (
              <button onClick={onOpenSavedMessages} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-tg-hover/40 hover:bg-tg-hover transition-colors text-right mb-3">
                <Bookmark size={20} className="text-tg-accent flex-shrink-0" />
                <div className="flex-1"><p className="text-tg-text text-sm">پیام‌های ذخیره شده</p><p className="text-tg-subtext text-xs mt-0.5">پیام‌های شخصی شما</p></div>
                <ChevronLeft size={18} className="text-tg-subtext" />
              </button>
            )}
            <button onClick={enterEdit} className="w-full flex items-center justify-center gap-2 bg-tg-hover hover:bg-tg-border text-tg-text font-medium rounded-xl py-3 transition-colors mb-5">
              <Pencil size={18} /> ویرایش پروفایل
            </button>
            <div className="mb-5">
              <input ref={backgroundInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0]
                if (f) {
                  const reader = new FileReader()
                  reader.onload = () => { if (reader.result) setBackground(String(reader.result)) }
                  reader.readAsDataURL(f)
                }
                e.currentTarget.value = ''
              }} />
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-tg-text font-bold text-sm flex items-center gap-2"><ImageIcon size={16} className="text-tg-accent"/> تغییر پس‌زمینه</h3>
                {chatBackground && <button type="button" onClick={() => setBackground('')} className="text-xs text-tg-subtext flex items-center gap-1"><RotateCcw size={13}/> اصلی</button>}
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {presetBackgrounds.map(([bg, name],i) => <button type="button" key={i} title={name} onClick={() => setBackground(bg)} className="h-12 rounded-lg border-2 border-transparent hover:border-tg-accent" style={{background:bg}} />)}
              </div>
              <button type="button" onClick={() => backgroundInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-tg-hover hover:bg-tg-border text-tg-text text-sm">
                <ImageIcon size={17}/> انتخاب عکس از گالری
              </button>
            </div>
          </>
        )}

        {/* Notifications */}
        <div className="border-t border-tg-border pt-5 mt-2">
          <h3 className="text-tg-text font-bold text-sm mb-3 flex items-center gap-2"><Bell size={16} className="text-tg-accent" /> اعلان‌ها</h3>
          <button onClick={handleToggleNotifications} disabled={notifLoading} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-tg-hover/40 hover:bg-tg-hover transition-colors disabled:opacity-50">
            <div className="flex items-center gap-3">
              {notifEnabled ? <Bell size={20} className="text-tg-green" /> : <BellOff size={20} className="text-tg-subtext" />}
              <div className="text-right">
                <p className="text-tg-text text-sm">{notifEnabled ? 'اعلان‌ها فعال است' : 'اعلان‌ها غیرفعال است'}</p>
                <p className="text-tg-subtext text-xs mt-0.5">{notifEnabled ? 'با پیام جدید آگاه می‌شوید' : 'برای دریافت نوتیف پیام‌ها فعال کنید'}</p>
              </div>
            </div>
            {notifLoading ? <Loader2 size={18} className="animate-spin text-tg-subtext" /> : (
              <div className={`w-11 h-6 rounded-full transition-colors flex items-center ${notifEnabled ? 'bg-tg-green justify-end' : 'bg-tg-border justify-start'}`}>
                <div className="w-5 h-5 rounded-full bg-white shadow m-0.5" />
              </div>
            )}
          </button>
        </div>

        {/* Storage / clear downloads */}
        <div className="border-t border-tg-border pt-5 mt-2">
          <div className="mb-5">
            <button onClick={() => setShowFolderManager(true)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-tg-hover/40 hover:bg-tg-hover text-right">
              <Folder size={20} className="text-tg-accent" />
              <div className="flex-1"><p className="text-tg-text text-sm">مدیریت پوشه‌های گفتگو</p><p className="text-tg-subtext text-xs mt-0.5">ساختن و حذف پوشه‌ها</p></div>
              <ChevronLeft size={18} className="text-tg-subtext" />
            </button>
          </div>
          <h3 className="text-tg-text font-bold text-sm mb-3 flex items-center gap-2"><HardDrive size={16} className="text-tg-accent" /> حافظه دستگاه</h3>
          <DownloadFolderSection />
          <DownloadedFilesManager />
        </div>

        {/* Password change */}
        <div className="border-t border-tg-border pt-5 mt-2">
          <h3 className="text-tg-text font-bold text-sm mb-3 flex items-center gap-2"><Lock size={16} className="text-tg-accent" /> تغییر رمز عبور</h3>
          <div className="space-y-3">
            <input type="password" placeholder="رمز فعلی" value={oldPassword} onChange={e => { setOldPassword(e.target.value); setPwError(null); setPwSuccess(false) }} className="w-full bg-tg-hover rounded-xl px-4 py-2.5 text-tg-text placeholder-tg-subtext outline-none focus:ring-2 ring-tg-accent" dir="ltr" />
            <input type="password" placeholder="رمز جدید" value={newPassword} onChange={e => { setNewPassword(e.target.value); setPwError(null); setPwSuccess(false) }} className="w-full bg-tg-hover rounded-xl px-4 py-2.5 text-tg-text placeholder-tg-subtext outline-none focus:ring-2 ring-tg-accent" dir="ltr" />
            <input type="password" placeholder="تکرار رمز جدید" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setPwError(null); setPwSuccess(false) }} className="w-full bg-tg-hover rounded-xl px-4 py-2.5 text-tg-text placeholder-tg-subtext outline-none focus:ring-2 ring-tg-accent" dir="ltr" />
            {pwError && <p className="text-tg-red text-sm text-center">{pwError}</p>}
            {pwSuccess && <p className="text-tg-green text-sm text-center flex items-center justify-center gap-1"><CheckCircle2 size={14} /> رمز عبور تغییر کرد</p>}
            <button onClick={handleChangePassword} disabled={pwLoading} className="w-full bg-tg-hover hover:bg-tg-border text-tg-text font-medium rounded-xl py-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {pwLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {pwLoading ? '...' : 'تغییر رمز'}
            </button>
          </div>
        </div>

        <div className="border-t border-tg-border pt-5 mt-2">
          <button onClick={() => { signOut(); onClose() }} className="w-full flex items-center justify-center gap-2 text-tg-red hover:bg-tg-hover rounded-xl py-3 transition-colors">
            <LogOut size={18} /> خروج از حساب
          </button>
        </div>
      </div>
      {showFolderManager && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowFolderManager(false)}>
          <div className="bg-tg-panel w-full max-w-md rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Folder size={20} className="text-tg-accent" />
              <h3 className="text-tg-text font-bold flex-1">مدیریت پوشه‌های گفتگو</h3>
              <button type="button" onClick={() => setShowFolderManager(false)} className="w-9 h-9 rounded-full hover:bg-tg-hover flex items-center justify-center text-tg-subtext"><X size={19}/></button>
            </div>
            <div className="flex gap-2 mb-4">
              <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createChatFolder()} placeholder="نام پوشه جدید" className="flex-1 bg-tg-hover rounded-xl px-3 py-2.5 text-tg-text outline-none" />
              <button type="button" onClick={createChatFolder} className="px-4 rounded-xl bg-tg-accent text-white flex items-center gap-1"><FolderPlus size={17}/>ساختن</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-tg-hover/50"><Folder size={18} className="text-tg-accent"/><div className="flex-1"><p className="text-tg-text text-sm">همه گفتگوها</p><p className="text-tg-subtext text-xs">همیشه فعال و قابل حذف نیست</p></div></div>
              {chatFolders.length === 0 && <p className="text-center text-tg-subtext text-sm py-4">هنوز پوشه‌ای ساخته نشده است.</p>}
              {chatFolders.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-tg-hover/50">
                  <Folder size={18} className="text-tg-accent"/>
                  <div className="flex-1 min-w-0"><p className="text-tg-text text-sm truncate">{f.name}</p><p className="text-tg-subtext text-xs">{f.chats.length} گفتگو</p></div>
                  <button type="button" onClick={() => removeChatFolder(f.id)} className="w-9 h-9 rounded-full hover:bg-tg-red/10 text-tg-red flex items-center justify-center" title="حذف پوشه"><Trash2 size={17}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
