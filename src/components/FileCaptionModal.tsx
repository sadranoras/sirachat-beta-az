import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, FileIcon, ImageIcon, RotateCw, Trash2, Crop, Type, Camera, Check, Pencil, Undo2, Video, Plus } from 'lucide-react'

interface FileCaptionModalProps {
  type: 'image' | 'file'
  file: File
  files?: File[]
  onSend: (caption: string, files?: File[]) => void
  onClose: () => void
}

type CropRect = { x:number; y:number; w:number; h:number }
type Point = { x:number; y:number }
type Stroke = Point[]
type EditState = { crop: CropRect; rotation: number; text: string; strokes: Stroke[] }

const emptyEdit = (): EditState => ({ crop: {x:0,y:0,w:1,h:1}, rotation:0, text:'', strokes:[] })
const isImage = (f: File) => f.type.startsWith('image/') || /\.(avif|bmp|gif|heic|heif|ico|jfif|jpe?g|jxl|png|svg|tif?f|webp)$/i.test(f.name)
const isVideo = (f: File) => f.type.startsWith('video/') || /\.(3gp|avi|flv|m4v|mkv|mov|mp4|mpeg|mpg|ogv|ts|webm|wmv)$/i.test(f.name)
const isAudio = (f: File) => f.type.startsWith('audio/') || /\.(aac|aiff?|alac|amr|flac|m4a|mid|midi|mp3|oga|ogg|opus|wav|wma|weba)$/i.test(f.name)

export default function FileCaptionModal({ type, file, files: initialFiles, onSend, onClose }: FileCaptionModalProps) {
  const [files, setFiles] = useState<File[]>(initialFiles?.length ? initialFiles : [file])
  const [index, setIndex] = useState(0)
  const [caption, setCaption] = useState('')
  const [editing, setEditing] = useState(false)
  const [editMode, setEditMode] = useState<'crop'|'draw'|'text'>('crop')
  const [edits, setEdits] = useState<Record<number, EditState>>({})
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [sending, setSending] = useState(false)
  const videoRef = useRef<HTMLVideoElement|null>(null)
  const streamRef = useRef<MediaStream|null>(null)
  const canvasRef = useRef<HTMLCanvasElement|null>(null)
    const drawingRef = useRef(false)
  const cropDragRef = useRef<{kind:'move'|'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w';sx:number;sy:number;start:CropRect}|null>(null)
  const current = files[index]
  const edit = edits[index] || emptyEdit()
  const previewUrl = useMemo(() => current ? URL.createObjectURL(current) : null, [current])
  const thumbUrlsRef = useRef<Map<File,string>>(new Map())
  const [, forceThumbRefresh] = useState(0)
  const getThumbUrl = (f: File) => {
    const existing = thumbUrlsRef.current.get(f)
    if (existing) return existing
    const url = URL.createObjectURL(f)
    thumbUrlsRef.current.set(f, url)
    return url
  }

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    thumbUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    thumbUrlsRef.current.clear()
  }, [previewUrl])
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()) }, [])

  const setEdit = (patch: Partial<EditState>) => setEdits(prev => ({ ...prev, [index]: { ...(prev[index] || emptyEdit()), ...patch } }))

  const openCamera = async () => {
    setCameraError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio:false })
      streamRef.current = stream
      setCameraOpen(true)
      requestAnimationFrame(() => { if (videoRef.current) videoRef.current.srcObject = stream })
    } catch { setCameraError('دسترسی به دوربین ممکن نیست. مجوز دوربین را فعال کنید.') }
  }
  const closeCamera = () => { streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current=null; setCameraOpen(false) }
  const takePhoto = () => {
    const v = videoRef.current
    if (!v?.videoWidth) return
    const c = document.createElement('canvas'); c.width=v.videoWidth; c.height=v.videoHeight
    c.getContext('2d')?.drawImage(v,0,0)
    c.toBlob(blob => {
      if (!blob) return
      setFiles(prev => [...prev, new File([blob], `camera-${Date.now()}.jpg`, { type:'image/jpeg' })])
      setIndex(files.length)
      closeCamera()
    }, 'image/jpeg', .92)
  }

  const beginCrop = () => { setEditMode('crop'); setEditing(true) }
  const beginDraw = () => { setEditMode('draw'); setEditing(true) }
  const beginText = () => { setEditMode('text'); setEditing(true) }
  const pointFromEvent = (e: ReactPointerEvent, el: HTMLElement): Point => {
    const r=el.getBoundingClientRect(); return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}
  }
  const handleEditorPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget
    const target = e.target as HTMLElement
    if (editMode === 'draw') {
      drawingRef.current = true
      const p = pointFromEvent(e, box)
      setEdits(prev => {
        const base = prev[index] || emptyEdit()
        return { ...prev, [index]: { ...base, strokes: [...base.strokes, [p]] } }
      })
      box.setPointerCapture?.(e.pointerId)
      e.preventDefault()
      return
    }
    if (editMode === 'crop') {
      const p = pointFromEvent(e, box)
      const r = edit.crop
      const handle = target.dataset.cropHandle as string | undefined
      let kind: 'move'|'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w' = (handle as any) || 'move'
      if (!handle) {
        const near = (a:number,b:number) => Math.abs(a-b) < 0.045
        if (near(p.x,r.x) && near(p.y,r.y)) kind='nw'
        else if (near(p.x,r.x+r.w) && near(p.y,r.y)) kind='ne'
        else if (near(p.x,r.x) && near(p.y,r.y+r.h)) kind='sw'
        else if (near(p.x,r.x+r.w) && near(p.y,r.y+r.h)) kind='se'
      }
      cropDragRef.current = { kind: kind as any, sx:e.clientX, sy:e.clientY, start:{...r} } as any
      box.setPointerCapture?.(e.pointerId)
      e.preventDefault()
    }
  }

  const handleEditorPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget
    if (editMode === 'draw' && drawingRef.current) {
      const p = pointFromEvent(e, box)
      setEdits(prev => {
        const base = prev[index] || emptyEdit()
        const strokes = base.strokes.slice()
        const last = strokes[strokes.length - 1]
        if (last) strokes[strokes.length - 1] = [...last, p]
        return { ...prev, [index]: { ...base, strokes } }
      })
      e.preventDefault()
      return
    }
    const d = cropDragRef.current as any
    if (editMode !== 'crop' || !d) return
    const r = box.getBoundingClientRect()
    const dx = (e.clientX-d.sx)/r.width
    const dy = (e.clientY-d.sy)/r.height
    let c = {...d.start} as CropRect
    const min = .04
    const right = d.start.x + d.start.w
    const bottom = d.start.y + d.start.h
    switch (d.kind) {
      case 'move':
        c.x = Math.max(0, Math.min(1-c.w, d.start.x+dx)); c.y = Math.max(0, Math.min(1-c.h, d.start.y+dy)); break
      case 'nw': c.x=Math.max(0,Math.min(right-min,d.start.x+dx)); c.y=Math.max(0,Math.min(bottom-min,d.start.y+dy)); c.w=right-c.x; c.h=bottom-c.y; break
      case 'n': c.y=Math.max(0,Math.min(bottom-min,d.start.y+dy)); c.h=bottom-c.y; break
      case 'ne': c.y=Math.max(0,Math.min(bottom-min,d.start.y+dy)); c.h=bottom-c.y; c.w=Math.max(min,Math.min(1-d.start.x,right+dx-d.start.x)); break
      case 'e': c.w=Math.max(min,Math.min(1-d.start.x,d.start.w+dx)); break
      case 'se': c.w=Math.max(min,Math.min(1-d.start.x,d.start.w+dx)); c.h=Math.max(min,Math.min(1-d.start.y,d.start.h+dy)); break
      case 's': c.h=Math.max(min,Math.min(1-d.start.y,d.start.h+dy)); break
      case 'sw': c.x=Math.max(0,Math.min(right-min,d.start.x+dx)); c.w=right-c.x; c.h=Math.max(min,Math.min(1-d.start.y,d.start.h+dy)); break
      case 'w': c.x=Math.max(0,Math.min(right-min,d.start.x+dx)); c.w=right-c.x; break
    }
    c.x=Math.max(0,Math.min(1-c.w,c.x)); c.y=Math.max(0,Math.min(1-c.h,c.y))
    setEdit({crop:c})
    e.preventDefault()
  }

  const handleEditorPointerUp = (e?: ReactPointerEvent<HTMLDivElement>) => {
    drawingRef.current = false
    cropDragRef.current = null
    if (e) { try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {} }
  }

  const drawEditor = () => {
    const canvas=canvasRef.current
    if(!canvas || !previewUrl || current?.type.startsWith('video/')) return
    const image=new Image(); image.onload=()=>{
      const c=canvas.getContext('2d'); if(!c) return
      canvas.width=image.naturalWidth; canvas.height=image.naturalHeight
      c.clearRect(0,0,canvas.width,canvas.height)
      c.drawImage(image,0,0)
    }; image.src=previewUrl
  }
  useEffect(()=>{ if(editing && isImage(current)) drawEditor() }, [editing,index,previewUrl])

  const buildEditedFile = async (f: File, i:number): Promise<File> => {
    if(!isImage(f)) return f
    const e=edits[i] || emptyEdit()
    if(e.crop.x===0&&e.crop.y===0&&e.crop.w===1&&e.crop.h===1&&e.rotation===0&&!e.text.trim()&&e.strokes.length===0) return f
    const bitmap=await createImageBitmap(f)
    const sx=Math.round(bitmap.width*e.crop.x), sy=Math.round(bitmap.height*e.crop.y)
    const sw=Math.max(1,Math.round(bitmap.width*e.crop.w)), sh=Math.max(1,Math.round(bitmap.height*e.crop.h))
    const rotated=Math.abs(e.rotation%180)===90
    const canvas=document.createElement('canvas'); canvas.width=rotated?sh:sw; canvas.height=rotated?sw:sh
    const c=canvas.getContext('2d')!; c.save(); c.translate(canvas.width/2,canvas.height/2); c.rotate(e.rotation*Math.PI/180); c.drawImage(bitmap,sx,sy,sw,sh,-sw/2,-sh/2,sw,sh); c.restore()
    c.lineCap='round'; c.lineJoin='round'; c.lineWidth=Math.max(5,canvas.width*.006); c.strokeStyle='#ff334d'
    for(const stroke of e.strokes){if(!stroke.length)continue;c.beginPath();stroke.forEach((p,j)=>{const x=p.x*canvas.width,y=p.y*canvas.height;j?c.lineTo(x,y):c.moveTo(x,y)});c.stroke()}
    if(e.text.trim()){c.font=`bold ${Math.max(28,canvas.width*.055)}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.lineWidth=8;c.strokeStyle='rgba(0,0,0,.65)';c.fillStyle='#fff';c.strokeText(e.text,canvas.width/2,canvas.height*.88);c.fillText(e.text,canvas.width/2,canvas.height*.88)}
    const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/jpeg',.92))
    return blob?new File([blob],f.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'}):f
  }

  const removeCurrent = () => {
    if(files.length<=1){onClose();return}
    setFiles(prev=>prev.filter((_,i)=>i!==index)); setIndex(Math.max(0,Math.min(index,files.length-2)))
  }
  const addMore = () => { const el = document.getElementById('sira-more-media-input') as HTMLInputElement | null; if (el) { el.value = ''; el.click() } }
  const send = async () => {
    if(sending) return
    setSending(true)
    try { const out:File[]=[]; for(let i=0;i<files.length;i++) out.push(await buildEditedFile(files[i],i)); onSend(caption,out) } finally { setSending(false) }
  }

  return createPortal(<div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
    <div dir="rtl" className={`bg-tg-panel rounded-2xl shadow-2xl border border-tg-hover overflow-hidden w-full ${editing?'max-w-5xl':'max-w-2xl'}`} onClick={e=>e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-tg-border">
        <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-tg-hover flex items-center justify-center text-tg-subtext"><X size={20}/></button>
        <h2 className="text-tg-text font-medium">{editing?'ویرایش تصویر':`ارسال رسانه${files.length>1?` (${files.length})`:''}`}</h2>
        <div className="flex gap-1">
          {!editing && <button onClick={cameraOpen?closeCamera:openCamera} className="w-9 h-9 rounded-full bg-tg-hover text-tg-text flex items-center justify-center"><Camera size={19}/></button>}
        </div>
      </div>

      {cameraOpen ? <div className="p-4">
        <div className="relative rounded-2xl overflow-hidden bg-black"><video ref={videoRef} autoPlay playsInline muted className="w-full max-h-[65vh] object-contain"/>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3"><button onClick={takePhoto} className="w-16 h-16 rounded-full bg-white border-4 border-tg-accent shadow-xl"/><button onClick={closeCamera} className="w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center"><X size={20}/></button></div>
        </div>{cameraError&&<p className="text-tg-red text-sm mt-2">{cameraError}</p>}
      </div> : editing ? <div className="bg-black p-3 sm:p-5">
        <div className="relative mx-auto max-w-4xl h-[72vh] bg-black rounded-xl overflow-hidden touch-none select-none" onPointerDown={handleEditorPointerDown} onPointerMove={handleEditorPointerMove} onPointerUp={handleEditorPointerUp} onPointerCancel={handleEditorPointerUp}>
          {previewUrl&&<img key={previewUrl || 'editor-image'} src={previewUrl} alt="ویرایش تصویر" className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none" draggable={false}/>}
          {editMode==='draw' && <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">{edit.strokes.map((s,i)=><polyline key={i} points={s.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#ff334d" strokeWidth="0.006" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>)}</svg>}
          {editMode==='text' && edit.text && <div className="absolute left-1/2 bottom-[12%] -translate-x-1/2 text-white text-3xl font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,.9)] whitespace-nowrap">{edit.text}</div>}
          {editMode==='crop' && <><div className="absolute inset-0 bg-black/45 pointer-events-none"/><div className="absolute border-2 border-white" style={{left:`${edit.crop.x*100}%`,top:`${edit.crop.y*100}%`,width:`${edit.crop.w*100}%`,height:`${edit.crop.h*100}%`,boxShadow:'0 0 0 9999px rgba(0,0,0,.25)'}}>
            {(['nw','n','ne','e','se','s','sw','w'] as const).map(k=><span key={k} data-crop-handle={k} className={`absolute z-20 bg-white border-2 border-tg-accent rounded-md shadow cursor-pointer touch-none ${k==='nw'?'w-7 h-7 left-[-14px] top-[-14px]':k==='n'?'w-10 h-3 left-1/2 top-[-6px] -translate-x-1/2':' '}${k==='ne'?'w-7 h-7 right-[-14px] top-[-14px]':''}${k==='e'?'w-3 h-10 right-[-6px] top-1/2 -translate-y-1/2':''}${k==='se'?'w-7 h-7 right-[-14px] bottom-[-14px]':''}${k==='s'?'w-10 h-3 left-1/2 bottom-[-6px] -translate-x-1/2':''}${k==='sw'?'w-7 h-7 left-[-14px] bottom-[-14px]':''}${k==='w'?'w-3 h-10 left-[-6px] top-1/2 -translate-y-1/2':''}`}/>)}</div></>}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
          <button onClick={()=>setEditMode('crop')} className={`px-4 py-2 rounded-xl ${editMode==='crop'?'bg-tg-accent text-white':'bg-tg-hover text-tg-text'}`}><Crop size={17} className="inline ml-1"/>برش آزاد</button>
          <button onClick={()=>setEditMode('draw')} className={`px-4 py-2 rounded-xl ${editMode==='draw'?'bg-tg-accent text-white':'bg-tg-hover text-tg-text'}`}><Pencil size={17} className="inline ml-1"/>قلم</button>
          <button onClick={()=>setEditMode('text')} className={`px-4 py-2 rounded-xl ${editMode==='text'?'bg-tg-accent text-white':'bg-tg-hover text-tg-text'}`}><Type size={17} className="inline ml-1"/>متن</button>
          <button onClick={()=>setEdit({rotation:edit.rotation+90})} className="px-4 py-2 rounded-xl bg-tg-hover text-tg-text"><RotateCw size={17} className="inline ml-1"/>چرخش</button>
          <button onClick={()=>setEdit({strokes:[]})} className="px-4 py-2 rounded-xl bg-tg-hover text-tg-text"><Undo2 size={17} className="inline ml-1"/>پاک کردن قلم</button>
          <button onClick={()=>setEditing(false)} className="px-5 py-2 rounded-xl bg-tg-accent text-white"><Check size={17} className="inline ml-1"/>تأیید</button>
          <button onClick={()=>setEditing(false)} className="px-4 py-2 rounded-xl bg-tg-hover text-tg-text">لغو</button>
        </div>
        {editMode==='text'&&<input autoFocus value={edit.text} onChange={e=>setEdit({text:e.target.value})} placeholder="متن روی عکس" className="mt-3 w-full max-w-xl mx-auto block bg-tg-hover rounded-xl px-4 py-3 text-tg-text outline-none"/>}
      </div> : <div className="p-4">
        <div className="bg-black rounded-2xl min-h-[280px] max-h-[60vh] flex items-center justify-center overflow-hidden relative">
          {isImage(current)&&previewUrl ? <img src={previewUrl} className="max-w-full max-h-[60vh] object-contain"/> : isVideo(current)&&previewUrl ? <video src={previewUrl} controls className="max-w-full max-h-[60vh] object-contain"/> : <div className="flex flex-col items-center gap-3 text-tg-subtext"><FileIcon size={48}/><span className="text-sm text-tg-text px-4 text-center break-all">{current?.name}</span></div>}
          {files.length>1&&<span className="absolute top-3 right-3 bg-black/65 text-white text-xs rounded-full px-2.5 py-1">{index+1} / {files.length}</span>}
        </div>
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
          {files.map((f,i)=><button key={`${f.name}-${i}`} onClick={()=>setIndex(i)} className={`relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 ${i===index?'border-tg-accent':'border-transparent'} bg-tg-hover`}>
            {isImage(f)?<img src={getThumbUrl(f)} className="w-full h-full object-cover"/>:isVideo(f)?<><video src={getThumbUrl(f)} className="w-full h-full object-cover" muted/><Video size={18} className="absolute bottom-1 right-1 text-white drop-shadow"/></>:<FileIcon className="m-auto text-tg-accent" size={27}/>}<span className="absolute top-1 left-1 bg-black/60 rounded-full text-white text-[10px] px-1">{i+1}</span>
          </button>)}
          <button onClick={addMore} className="shrink-0 w-20 h-20 rounded-xl bg-tg-hover flex items-center justify-center text-tg-subtext"><Plus size={25}/></button>
        </div>
        <input id="sira-more-media-input" type="file" multiple accept="*/*" className="hidden" onChange={e=>{const fs=Array.from(e.target.files||[]);if(fs.length){setFiles(p=>{ const next=[...p,...fs]; setIndex(next.length-fs.length); return next })}e.currentTarget.value=''}}/>
        {isImage(current)&&<div className="flex gap-2 mt-2"><button onClick={beginCrop} className="flex-1 py-2 rounded-xl bg-tg-hover text-tg-text"><Crop size={17} className="inline ml-1"/>ویرایش</button><button onClick={removeCurrent} className="w-11 rounded-xl bg-tg-hover text-tg-red flex items-center justify-center"><Trash2 size={17}/></button></div>}
        <div className="flex gap-2 mt-3"><textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="توضیح..." rows={2} className="flex-1 bg-tg-hover rounded-xl px-4 py-3 text-tg-text outline-none resize-none"/><button disabled={sending} onClick={send} className="w-14 h-14 rounded-full bg-tg-accent disabled:opacity-50 flex items-center justify-center shrink-0"><Send size={21} className="text-white"/></button></div>
      </div>}
    </div>
  </div>, document.body)
}
