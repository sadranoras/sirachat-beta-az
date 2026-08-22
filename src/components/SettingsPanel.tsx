import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { subscribeToPush } from '../lib/push'
import { X, Camera, LogOut, Phone, Eye, EyeOff, Lock, Loader2, CheckCircle2, Pencil, AtSign, Info, HardDrive, ChevronLeft, Bookmark, Bell, BellOff } from 'lucide-react'
import Avatar from './Avatar'
import DownloadFolderSection from './DownloadFolderSection'
import DownloadedFilesManager from './DownloadedFilesManager'
import { enableTwoFactor, verifyTwoFactor } from '../lib/accountSecurity'

interface SettingsPanelProps { onClose: () => void; onOpenSavedMessages?: () => void }

export default function SettingsPanel({ onClose, onOpenSavedMessages }: SettingsPanelProps) {
  const { user, profile, signOut, updateProfile } = useAuth()
  const [editing, setEditing] = useState(false)

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

  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [twoFactor, setTwoFactor] = useState<any>(null)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorMessage, setTwoFactorMessage] = useState('')
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  const [chatBackground, setChatBackground] = useState(() => localStorage.getItem('sira-chat-background') || '')

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotifEnabled(Notification.permission === 'granted')
    }
  }, [])

  const applyChatBackground = (value: string) => {
    setChatBackground(value)
    localStorage.setItem('sira-chat-background', value)
    window.dispatchEvent(new CustomEvent('chat-background-change', { detail: value }))
  }

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

  const handleEnableTwoFactor = async () => {
    setTwoFactorLoading(true)
    setTwoFactorMessage('')
    try {
      const data = await enableTwoFactor()
      setTwoFactor(data)
      setTwoFactorMessage('Authenticator را باز کنید و Secret را وارد کنید، سپس کد ۶ رقمی را وارد کنید.')
    } catch (e: any) {
      setTwoFactorMessage(e?.message || 'فعال‌سازی تأیید دو مرحله‌ای ناموفق بود')
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const handleVerifyTwoFactor = async () => {
    if (!twoFactor?.id || !twoFactorCode.trim()) return
    setTwoFactorLoading(true)
    setTwoFactorMessage('')
    try {
      await verifyTwoFactor(twoFactor.id, twoFactorCode.trim())
      setTwoFactorMessage('تأیید دو مرحله‌ای با موفقیت فعال شد.')
      setTwoFactor(null)
      setTwoFactorCode('')
    } catch (e: any) {
      setTwoFactorMessage(e?.message || 'کد تأیید نادرست است')
    } finally {
      setTwoFactorLoading(false)
    }
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

        <div className="mb-5 p-3 rounded-xl bg-tg-hover/50">
          <div className="flex items-center justify-between mb-2"><span className="text-tg-text text-sm font-medium">پس‌زمینه گفتگو</span><button onClick={() => applyChatBackground('')} className="text-xs text-tg-accent">اولیه</button></div>
          <div className="flex gap-2 flex-wrap">
            {['','linear-gradient(135deg,#0e1621,#17212b)','linear-gradient(135deg,#17212b,#0d3b4c)','linear-gradient(135deg,#20133b,#12263a)','linear-gradient(135deg,#332b16,#17212b)'].map((v,i)=><button key={i} onClick={()=>applyChatBackground(v)} className={`w-12 h-12 rounded-xl border-2 ${chatBackground===v?'border-tg-accent':'border-tg-hover'}`} style={{background:v||'#0e1621'}} title={i===0?'پس‌زمینه اولیه':'پس‌زمینه '+i}/>) }
          </div>
        </div>

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
              {onOpenSavedMessages && profile?.username && (
                <button
                  onClick={onOpenSavedMessages}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-tg-hover/40 hover:bg-tg-hover transition-colors text-right"
                >
                  <AtSign size={20} className="text-tg-subtext flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-tg-text text-sm" dir="ltr">@{profile.username}</p>
                    <p className="text-tg-subtext text-xs mt-0.5">نام کاربری</p>
                  </div>
                  <Bookmark size={16} className="text-tg-subtext flex-shrink-0" />
                </button>
              )}
              {(!onOpenSavedMessages || !profile?.username) && (
                <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-tg-hover/40">
                  <AtSign size={20} className="text-tg-subtext flex-shrink-0" />
                  <div>
                    <p className="text-tg-text text-sm" dir="ltr">{profile?.username ? `@${profile.username}` : '—'}</p>
                    <p className="text-tg-subtext text-xs mt-0.5">نام کاربری</p>
                  </div>
                </div>
              )}
              {onOpenSavedMessages && profile?.phone && (
                <button
                  onClick={onOpenSavedMessages}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-tg-hover/40 hover:bg-tg-hover transition-colors text-right"
                >
                  <Phone size={20} className="text-tg-subtext flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-tg-text text-sm" dir="ltr">{profile.phone}</p>
                    <p className="text-tg-subtext text-xs mt-0.5">شماره تلفن{!profile.phone_visible ? ' (مخفی)' : ''}</p>
                  </div>
                  <Bookmark size={16} className="text-tg-subtext flex-shrink-0" />
                </button>
              )}
              {(!onOpenSavedMessages || !profile?.phone) && (
                <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-tg-hover/40">
                  <Phone size={20} className="text-tg-subtext flex-shrink-0" />
                  <div>
                    <p className="text-tg-text text-sm" dir="ltr">{profile?.phone || '—'}</p>
                    <p className="text-tg-subtext text-xs mt-0.5">شماره تلفن{!profile?.phone_visible ? ' (مخفی)' : ''}</p>
                  </div>
                </div>
              )}
            </div>
            <button onClick={enterEdit} className="w-full flex items-center justify-center gap-2 bg-tg-hover hover:bg-tg-border text-tg-text font-medium rounded-xl py-3 transition-colors mb-5">
              <Pencil size={18} /> ویرایش پروفایل
            </button>
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
          <h3 className="text-tg-text font-bold text-sm mb-3 flex items-center gap-2"><Lock size={16} className="text-tg-accent" /> تأیید دو مرحله‌ای</h3>
          <button onClick={handleEnableTwoFactor} disabled={twoFactorLoading} className="w-full bg-tg-hover hover:bg-tg-border text-tg-text font-medium rounded-xl py-2.5 transition-colors disabled:opacity-50">
            {twoFactorLoading ? '...' : 'فعال‌سازی تأیید دو مرحله‌ای'}
          </button>
          {twoFactor?.totp?.secret && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-tg-subtext">Secret:</p>
              <code className="block bg-tg-hover rounded-lg p-2 text-xs break-all" dir="ltr">{twoFactor.totp.secret}</code>
              <input type="text" inputMode="numeric" maxLength={6} placeholder="کد ۶ رقمی Authenticator" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g,''))} className="w-full bg-tg-hover rounded-xl px-4 py-2.5 text-tg-text placeholder-tg-subtext outline-none focus:ring-2 ring-tg-accent" dir="ltr" />
              <button onClick={handleVerifyTwoFactor} disabled={twoFactorLoading || twoFactorCode.length !== 6} className="w-full bg-tg-accent hover:bg-tg-accent2 text-white font-medium rounded-xl py-2.5 disabled:opacity-50">تأیید و فعال‌سازی</button>
            </div>
          )}
          {twoFactorMessage && <p className="text-tg-subtext text-xs mt-2 text-center">{twoFactorMessage}</p>}
        </div>

        <div className="border-t border-tg-border pt-5 mt-2">
          <button onClick={() => { signOut(); onClose() }} className="w-full flex items-center justify-center gap-2 text-tg-red hover:bg-tg-hover rounded-xl py-3 transition-colors">
            <LogOut size={18} /> خروج از حساب
          </button>
        </div>
      </div>
    </div>
  )
}
