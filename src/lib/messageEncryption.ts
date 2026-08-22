const enc = new TextEncoder()
const dec = new TextDecoder()

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength)
  copy.set(value)
  return copy.buffer
}
function b64(x: Uint8Array) {
  let s = ''
  for (let i=0; i<x.length; i+=0x8000) s += String.fromCharCode(...x.subarray(i,i+0x8000))
  return btoa(s)
}
function ub64(s:string) {
  const x=atob(s), o=new Uint8Array(x.length)
  for(let i=0;i<x.length;i++) o[i]=x.charCodeAt(i)
  return o
}
async function derive(p:string,s:Uint8Array) {
  const m=await crypto.subtle.importKey('raw', asArrayBuffer(enc.encode(p)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {name:'PBKDF2',salt:asArrayBuffer(s),iterations:310000,hash:'SHA-256'},
    m,{name:'AES-GCM',length:256},false,['encrypt','decrypt']
  )
}
export async function lockMessage(text:string,password:string) {
  if(password.length<4) throw new Error('رمز باید حداقل ۴ کاراکتر باشد')
  const salt=crypto.getRandomValues(new Uint8Array(16))
  const iv=crypto.getRandomValues(new Uint8Array(12))
  const k=await derive(password,salt)
  const d=await crypto.subtle.encrypt({name:'AES-GCM',iv:asArrayBuffer(iv)},k,asArrayBuffer(enc.encode(text)))
  return JSON.stringify({v:1,alg:'AES-256-GCM',salt:b64(salt),iv:b64(iv),data:b64(new Uint8Array(d))})
}
export async function unlockMessage(payload:string,password:string) {
  const p=JSON.parse(payload), k=await derive(password,ub64(p.salt))
  try {
    return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:asArrayBuffer(ub64(p.iv))},k,asArrayBuffer(ub64(p.data))))
  } catch { throw new Error('رمز اشتباه است') }
}
export function isLockedMessage(v?:string|null) {
  if(!v)return false
  try { const p=JSON.parse(v); return p?.v===1&&p?.alg==='AES-256-GCM'&&typeof p?.data==='string' } catch { return false }
}
