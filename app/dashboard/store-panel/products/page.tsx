'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

// ✅ توابع کمکی برای فرمت اعداد
const formatPrice = (value: string | number) => {
  if (value === undefined || value === null) return '';
  const str = String(value);
  const englishStr = str
    .replace(/[۰-۹]/g, (w) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(w)))
    .replace(/[٠-٩]/g, (w) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(w)))
    .replace(/,/g, '')
    .replace(/[^0-9]/g, '');

  if (!englishStr) return '';
  return Number(englishStr).toLocaleString('en-US');
};

const parsePrice = (value: string) => {
  const englishStr = value
    .replace(/[۰-۹]/g, (w) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(w)))
    .replace(/[٠-٩]/g, (w) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(w)))
    .replace(/,/g, '')
    .replace(/[^0-9]/g, '');
  return Number(englishStr) || 0;
};

// ✅ کوچک کردن عکس قبل از آپلود (برای لود سریع‌تر عکس‌ها در سایت)
const MAX_IMAGE_SIDE = 1000

const compressImage = async (file: File): Promise<{ body: Blob; ext: string; type: string }> => {
  const original = { body: file as Blob, ext: file.name.split('.').pop() || 'jpg', type: file.type }

  // فقط JPEG و PNG و WebP کوچک می‌شوند؛ بقیه‌ی فرمت‌ها همان‌طور که هستند آپلود می‌شوند
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return original

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      const url = URL.createObjectURL(file)
      el.onload = () => { URL.revokeObjectURL(url); resolve(el) }
      el.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
      el.src = url
    })

    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.round(img.naturalWidth * scale)
    const height = Math.round(img.naturalHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(img, 0, 0, width, height)

    const toBlob = (type: string, quality: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

    let blob = await toBlob('image/webp', 0.82)
    let ext = 'webp'

    // مرورگرهای قدیمی WebP نمی‌سازند؛ در این حالت JPEG با پس‌زمینه‌ی سفید می‌سازیم
    if (!blob || blob.type !== 'image/webp') {
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      blob = await toBlob('image/jpeg', 0.85)
      ext = 'jpg'
    }

    // اگر نتیجه از فایل اصلی سنگین‌تر شد، همان فایل اصلی را نگه می‌داریم
    if (!blob || blob.size >= file.size) return original

    return { body: blob, ext, type: blob.type }
  } catch {
    return original
  }
}

type ImageSlot = { url: string; id?: string; file?: File } | null;
type CardStatus = { id: string; state: 'saving' | 'success' | 'error' } | null;

// ✅ تایپ برای محصولات در حال آپلود
type PendingProduct = {
  tempId: string;
  title: string;
  price: number;
  image_url: string | null;
  status: 'saving' | 'error';
  formData: any; // برای ذخیره اطلاعات جهت تلاش مجدد
}

// ───────── کامپوننت‌های ظاهری فرم محصول ─────────
// نکته: این‌ها عمداً بیرون از صفحه‌ی اصلی تعریف شده‌اند تا هنگام تایپ، مکان‌نما از input نپرد

type FormValues = {
  title: string; price: string; discountPrice: string; stock: string;
  category: string; size: string; color: string; description: string;
}

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'

const FormSection = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h4 className="text-sm font-black text-gray-800">{title}</h4>
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </div>
    {children}
  </section>
)

const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="mb-1.5 block text-xs font-bold text-gray-600">
    {children}{required && <span className="mr-0.5 text-red-500">*</span>}
  </label>
)

// ✅ گالری عکس‌ها (یک کاور بزرگ + ۴ عکس کوچک)
const ImageSlotsGrid = ({ slots, onSelect, onRemove, refs }: { slots: ImageSlot[], onSelect: any, onRemove: any, refs: any }) => {
  const count = slots.filter(Boolean).length
  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        <div className="group relative col-span-4 h-40 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 transition-colors hover:border-indigo-400 hover:bg-indigo-50 sm:h-44">
          <input type="file" accept="image/*" onChange={(e) => onSelect(0, e)} ref={el => { refs.current[0] = el }} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
          {slots[0] ? (
            <>
              <img src={slots[0].url} alt="Cover" className="h-full w-full object-cover" />
              <span className="absolute right-2 top-2 rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white shadow-sm">عکس کاور</span>
              <button type="button" aria-label="حذف عکس کاور" onClick={(e) => { e.preventDefault(); onRemove(0); }} className="absolute left-2 top-2 z-20 rounded-lg bg-white/95 p-1.5 text-red-500 shadow-sm transition hover:bg-red-50"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 text-indigo-500">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></span>
              <span className="text-xs font-bold">افزودن عکس کاور</span>
              <span className="px-4 text-center text-[10px] text-gray-400">عکس واضح و با پس‌زمینه‌ی ساده، فروش را بیشتر می‌کند</span>
            </div>
          )}
        </div>

        {[1, 2, 3, 4].map((index) => (
          <div key={index} className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-white transition-colors hover:border-indigo-300 hover:bg-indigo-50/40">
            <input type="file" accept="image/*" onChange={(e) => onSelect(index, e)} ref={el => { refs.current[index] = el }} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
            {slots[index] ? (
              <>
                <img src={slots[index]!.url} alt={`Slot ${index}`} className="h-full w-full object-cover" />
                <button type="button" aria-label="حذف عکس" onClick={(e) => { e.preventDefault(); onRemove(index); }} className="absolute right-1 top-1 z-20 rounded-md bg-white/95 p-1 text-red-500 shadow-sm transition hover:bg-red-50"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-300 transition-colors group-hover:text-indigo-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">{count.toLocaleString('fa-IR')} از ۵ عکس · عکس‌ها خودکار سبک می‌شوند تا سایت سریع‌تر لود شود</p>
    </div>
  )
}

// ✅ فیلدهای مشترک فرم افزودن و ویرایش
const ProductFormFields = ({ values, onChange, showCategory, slots, onSelectImage, onRemoveImage, refs }: {
  values: FormValues
  onChange: (field: keyof FormValues, value: string) => void
  showCategory: boolean
  slots: ImageSlot[]
  onSelectImage: any
  onRemoveImage: any
  refs: any
}) => {
  const priceNum = parsePrice(values.price)
  const discNum = parsePrice(values.discountPrice)
  const hasDisc = discNum > 0
  const discInvalid = hasDisc && priceNum > 0 && discNum >= priceNum
  const percent = hasDisc && priceNum > 0 && discNum < priceNum ? Math.round((1 - discNum / priceNum) * 100) : 0
  const stockNum = Number(values.stock) || 0

  return (
    <div className="space-y-4">
      <FormSection title="تصاویر محصول" hint="حداکثر ۵ عکس">
        <ImageSlotsGrid slots={slots} onSelect={onSelectImage} onRemove={onRemoveImage} refs={refs} />
      </FormSection>

      <FormSection title="اطلاعات اصلی">
        <div className="space-y-3">
          <div>
            <FieldLabel required>نام محصول</FieldLabel>
            <input type="text" value={values.title} onChange={(e) => onChange('title', e.target.value)} required placeholder="مثلاً: اسپیکر بلوتوثی قابل حمل" className={inputClass} />
            <div className="mt-1 text-left text-[10px] text-gray-400">{values.title.length.toLocaleString('fa-IR')} کاراکتر</div>
          </div>

          {showCategory && (
            <div>
              <FieldLabel>دسته‌بندی</FieldLabel>
              <input type="text" value={values.category} onChange={(e) => onChange('category', e.target.value)} placeholder="مثلاً: هندزفری" className={inputClass} />
            </div>
          )}

          <div>
            <FieldLabel>توضیحات</FieldLabel>
            <textarea value={values.description} onChange={(e) => onChange('description', e.target.value)} rows={4} placeholder="ویژگی‌ها، جنس، گارانتی و هر نکته‌ای که مشتری باید بداند..." className={`${inputClass} resize-none`}></textarea>
          </div>
        </div>
      </FormSection>

      <FormSection title="قیمت و موجودی">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel required>قیمت اصلی</FieldLabel>
            <div className="relative">
              <input type="text" inputMode="numeric" value={values.price} onChange={(e) => onChange('price', formatPrice(e.target.value))} required dir="ltr" placeholder="0" className={`${inputClass} pl-16 text-left`} />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">تومان</span>
            </div>
          </div>

          <div>
            <FieldLabel>قیمت با تخفیف</FieldLabel>
            <div className="relative">
              <input type="text" inputMode="numeric" value={values.discountPrice} onChange={(e) => onChange('discountPrice', formatPrice(e.target.value))} dir="ltr" placeholder="اختیاری" className={`${inputClass} pl-16 text-left font-bold ${discInvalid ? 'border-red-300 text-red-600 focus:border-red-400 focus:ring-red-100' : 'text-green-600'}`} />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">تومان</span>
            </div>
            {percent > 0 && <p className="mt-1 text-[11px] font-bold text-green-600">٪{percent.toLocaleString('fa-IR')} تخفیف برای مشتری نمایش داده می‌شود</p>}
            {discInvalid && <p className="mt-1 text-[11px] font-bold text-red-500">قیمت تخفیف‌خورده باید کمتر از قیمت اصلی باشد، وگرنه تخفیف نمایش داده نمی‌شود.</p>}
          </div>

          <div className="sm:col-span-2">
            <FieldLabel required>موجودی</FieldLabel>
            <div className="flex items-stretch gap-2" dir="ltr">
              <button type="button" aria-label="کم کردن موجودی" onClick={() => onChange('stock', String(Math.max(0, stockNum - 1)))} className="grid w-11 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-100 active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
              </button>
              <input type="number" min={0} value={values.stock} onChange={(e) => onChange('stock', e.target.value)} required placeholder="0" className={`${inputClass} text-center`} />
              <button type="button" aria-label="زیاد کردن موجودی" onClick={() => onChange('stock', String(stockNum + 1))} className="grid w-11 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-100 active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="ویژگی‌ها" hint="اختیاری">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>سایز</FieldLabel>
            <input type="text" value={values.size} onChange={(e) => onChange('size', e.target.value)} placeholder="مثلاً: L" className={inputClass} />
          </div>
          <div>
            <FieldLabel>رنگ</FieldLabel>
            <input type="text" value={values.color} onChange={(e) => onChange('color', e.target.value)} placeholder="مثلاً: مشکی" className={inputClass} />
          </div>
        </div>
      </FormSection>
    </div>
  )
}

// ✅ پیش‌نمایش زنده‌ی کارت محصول (فقط در فرم افزودن، روی صفحه‌های بزرگ)
const ProductPreview = ({ title, price, discountPrice, imageUrl, stock }: { title: string; price: string; discountPrice: string; imageUrl?: string | null; stock: string }) => {
  const priceNum = parsePrice(price)
  const discNum = parsePrice(discountPrice)
  const hasDisc = discNum > 0 && priceNum > 0 && discNum < priceNum
  const percent = hasDisc ? Math.round((1 - discNum / priceNum) * 100) : 0
  const shown = hasDisc ? discNum : priceNum
  const soldOut = stock !== '' && Number(stock) === 0

  return (
    <div>
      <p className="mb-2 text-xs font-bold text-gray-500">پیش‌نمایش کارت در فروشگاه</p>
      <div className="relative rounded-[24px] border border-gray-100 bg-white p-2.5 pb-9 shadow-[0_2px_15px_rgb(0,0,0,0.08)]">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[18px] bg-gray-50">
          {hasDisc && (
            <div className="absolute right-3 top-0 z-10 rounded-b-xl bg-[#d4003f] px-2.5 pb-1.5 pt-1 shadow-[0_4px_8px_-2px_rgba(212,0,63,0.55)]">
              <span className="text-[11px] font-black text-white">{percent.toLocaleString('fa-IR')}٪ تخفیف</span>
            </div>
          )}
          {soldOut && <span className="absolute right-2 top-2 z-10 rounded-lg bg-red-500 px-2 py-1 text-[11px] font-black text-white">ناموجود</span>}
          {imageUrl ? (
            <img src={imageUrl} alt="پیش‌نمایش" className="h-full w-full object-contain p-2" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          )}
        </div>
        <div className="px-1 pt-3">
          <h5 className="truncate text-sm font-bold text-gray-800">{title || 'نام محصول'}</h5>
          <div className="mt-2 flex flex-col items-end">
            {hasDisc && <span className="text-[11px] font-medium text-red-500 line-through">{priceNum.toLocaleString()}</span>}
            <span className="text-sm font-black leading-none text-gray-900">{shown.toLocaleString()} <span className="mr-0.5 text-[10px] font-medium text-gray-500">تومان</span></span>
          </div>
        </div>
        <div className="absolute bottom-2 left-1/2 flex h-11 w-11 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-b from-[#ff3b7a] to-[#d4003f] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-3px_6px_rgba(0,0,0,0.18),0_4px_0_#9c002d,0_10px_16px_-4px_rgba(212,0,63,0.55)]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
        </div>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([])
  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [cardStatus, setCardStatus] = useState<CardStatus>(null)

  // ✅ استیت‌های مودال افزودن
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    title: '', price: '', discountPrice: '', stock: '',
    description: '', category: '', size: '', color: '',
    contactPhone: '', contactEmail: '',
    addSlots: [null, null, null, null, null] as ImageSlot[]
  })
  const addFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // استیت‌های مودال ویرایش
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editDiscountPrice, setEditDiscountPrice] = useState('')
  const [editStock, setEditStock] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSize, setEditSize] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editSlots, setEditSlots] = useState<ImageSlot[]>([null, null, null, null, null])
  const editFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const showToastMsg = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000)
  }

  const fetchProducts = async (sId: string) => {
    const { data } = await supabase
      .from('products')
      .select('*, product_images(*)')
      .eq('store_id', sId)
      .order('created_at', { ascending: false })
    if (data) setProducts(data)
  }

  useEffect(() => {
    const initPage = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: storeData } = await supabase.from('stores').select('id, status').eq('owner_id', session.user.id).maybeSingle()
      if (!storeData || storeData.status !== 'active') { router.push('/dashboard'); return }

      setStoreId(storeData.id)
      await fetchProducts(storeData.id)
      setLoading(false)
    }
    initPage()
  }, [router])

  // ✅ آپلود عکس (قبل از آپلود، عکس کوچک و به WebP تبدیل می‌شود)
  const uploadImage = async (file: File) => {
    const { body, ext, type } = await compressImage(file)
    const fileName = `${Math.random()}.${ext}`
    const filePath = `${storeId}/${fileName}`

    const { error } = await supabase.storage.from('product-images').upload(filePath, body, {
      contentType: type,
      cacheControl: '31536000'
    })
    if (error) throw error

    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(filePath)
    return publicUrl
  }

  const handleAddImageSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const newSlots = [...addForm.addSlots]
      newSlots[index] = { url: URL.createObjectURL(file), file: file }
      setAddForm({ ...addForm, addSlots: newSlots })
    }
  }

  const handleAddImageRemove = (index: number) => {
    const newSlots = [...addForm.addSlots]
    newSlots[index] = null
    setAddForm({ ...addForm, addSlots: newSlots })
    if (addFileInputRefs.current[index]) addFileInputRefs.current[index]!.value = ''
  }

  const resetAddForm = () => {
    setAddForm({
      title: '', price: '', discountPrice: '', stock: '',
      description: '', category: '', size: '', color: '',
      contactPhone: '', contactEmail: '',
      addSlots: [null, null, null, null, null]
    })
    addFileInputRefs.current.forEach(ref => { if(ref) ref.value = '' });
  }

  // ✅ ثبت خوش‌بینانه (Optimistic UI)
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId) return

    // ۱. گرفتن کپی از اطلاعات برای ارسال در پس‌زمینه
    const currentFormData = { ...addForm }
    const tempId = `temp-${Date.now()}`

    // ۲. ساخت یک کارت موقت برای نمایش در لیست
    const newPending: PendingProduct = {
      tempId,
      title: currentFormData.title,
      price: parsePrice(currentFormData.price),
      image_url: currentFormData.addSlots[0]?.url || null,
      status: 'saving',
      formData: currentFormData
    }

    setPendingProducts(prev => [newPending, ...prev])

    // ۳. بستن فوری مودال و خالی کردن فرم
    setShowAddModal(false)
    resetAddForm()

    // ۴. شروع آپلود در پس‌زمینه
    try {
      const finalImageUrls: string[] = []
      for (const slot of currentFormData.addSlots) {
        if (slot?.file) {
          const url = await uploadImage(slot.file)
          finalImageUrls.push(url)
        }
      }
      const mainImageUrl = finalImageUrls.length > 0 ? finalImageUrls[0] : null

      const { data: newProduct, error: productError } = await supabase.from('products').insert([{
        store_id: storeId,
        title: currentFormData.title,
        description: currentFormData.description,
        price: parsePrice(currentFormData.price),
        discount_price: currentFormData.discountPrice ? parsePrice(currentFormData.discountPrice) : null,
        stock: Number(currentFormData.stock),
        image_url: mainImageUrl,
        category: currentFormData.category,
        size: currentFormData.size,
        color: currentFormData.color,
        contact_phone: currentFormData.contactPhone,
        contact_email: currentFormData.contactEmail,
        status: 'pending_approval'
      }]).select().single()

      if (productError) throw productError

      if (finalImageUrls.length > 0) {
        const imageRecords = finalImageUrls.map((url, index) => ({
          product_id: newProduct.id,
          image_url: url,
          is_main: index === 0
        }))
        await supabase.from('product_images').insert(imageRecords)
      }

      // ۵. در صورت موفقیت: حذف از لیست موقت و آپدیت لیست اصلی
      setPendingProducts(prev => prev.filter(p => p.tempId !== tempId))
      await fetchProducts(storeId)
      showToastMsg('محصول با موفقیت ثبت شد.', 'success')

    } catch (error: any) {
      // ۶. در صورت خطا: تغییر وضعیت کارت موقت به خطا
      setPendingProducts(prev => prev.map(p =>
        p.tempId === tempId ? { ...p, status: 'error' } : p
      ))
      showToastMsg(`خطا در ثبت: ${error.message}`, 'error')
    }
  }

  // ✅ تلاش مجدد (Retry) با کلیک روی کارت خطادار
  const handleRetryAdd = (pending: PendingProduct) => {
    setAddForm(pending.formData)
    setShowAddModal(true)
    setPendingProducts(prev => prev.filter(p => p.tempId !== pending.tempId))
  }

  // --- بخش ویرایش محصول ---
  const openEditModal = (product: any) => {
    setEditingProduct(product)
    setEditTitle(product.title)
    setEditPrice(formatPrice(product.price))
    setEditDiscountPrice(product.discount_price ? formatPrice(product.discount_price) : '')
    setEditStock(product.stock)
    setEditDescription(product.description || '')
    setEditSize(product.size || '')
    setEditColor(product.color || '')

    const initialSlots: ImageSlot[] = [null, null, null, null, null]
    let images = product.product_images || []

    if (images.length === 0 && product.image_url) {
      images = [{ id: 'legacy', image_url: product.image_url, is_main: true }]
    }

    images.sort((a: any, b: any) => (b.is_main ? 1 : -1) - (a.is_main ? 1 : -1))

    images.forEach((img: any, i: number) => {
      if (i < 5) initialSlots[i] = { url: img.image_url, id: img.id }
    })
    setEditSlots(initialSlots)
  }

  const handleEditImageSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const newSlots = [...editSlots]
      newSlots[index] = { url: URL.createObjectURL(file), file: file }
      setEditSlots(newSlots)
    }
  }

  const handleEditImageRemove = (index: number) => {
    const newSlots = [...editSlots]
    newSlots[index] = null
    setEditSlots(newSlots)
    if (editFileInputRefs.current[index]) editFileInputRefs.current[index]!.value = ''
  }

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return

    const pid = editingProduct.id
    setEditingProduct(null)
    setCardStatus({ id: pid, state: 'saving' })

    try {
      await supabase.from('product_images').delete().eq('product_id', pid)

      const finalImageUrls: string[] = []
      for (const slot of editSlots) {
        if (slot?.file) {
          const url = await uploadImage(slot.file)
          finalImageUrls.push(url)
        } else if (slot?.url) {
          finalImageUrls.push(slot.url)
        }
      }

      const mainImageUrl = finalImageUrls.length > 0 ? finalImageUrls[0] : null

      const { error } = await supabase.from('products').update({
        title: editTitle,
        price: parsePrice(editPrice),
        discount_price: editDiscountPrice ? parsePrice(editDiscountPrice) : null,
        stock: Number(editStock), description: editDescription, size: editSize, color: editColor,
        image_url: mainImageUrl,
        status: 'pending_approval',
        rejection_reason: null
      }).eq('id', pid)

      if (error) throw error

      if (finalImageUrls.length > 0) {
        const imageRecords = finalImageUrls.map((url, index) => ({
          product_id: pid,
          image_url: url,
          is_main: index === 0
        }))
        await supabase.from('product_images').insert(imageRecords)
      }

      setCardStatus({ id: pid, state: 'success' })
      setTimeout(() => { setCardStatus(null); if (storeId) fetchProducts(storeId); }, 3000)

    } catch (error: any) {
      setCardStatus({ id: pid, state: 'error' })
      setTimeout(() => { setCardStatus(null) }, 4000)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('آیا از حذف این محصول مطمئن هستید؟')) return

    setCardStatus({ id: productId, state: 'saving' })
    const { error } = await supabase.from('products').delete().eq('id', productId)

    if (error) {
      setCardStatus({ id: productId, state: 'error' })
      setTimeout(() => setCardStatus(null), 4000)
    } else {
      setCardStatus({ id: productId, state: 'success' })
      setTimeout(async () => { setCardStatus(null); if (storeId) await fetchProducts(storeId); }, 2000)
    }
  }

  // ✅ هماهنگ‌کننده‌ی فیلدهای فرم ویرایش با فرم مشترک
  const handleEditFieldChange = (field: keyof FormValues, value: string) => {
    if (field === 'title') setEditTitle(value)
    else if (field === 'price') setEditPrice(value)
    else if (field === 'discountPrice') setEditDiscountPrice(value)
    else if (field === 'stock') setEditStock(value)
    else if (field === 'size') setEditSize(value)
    else if (field === 'color') setEditColor(value)
    else if (field === 'description') setEditDescription(value)
  }

  if (loading && !storeId) return <div className="flex justify-center items-center min-h-screen bg-gray-50"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div></div>

  return (
    <div className="p-4 sm:p-8 relative">

      {/* ✅ پیام شناور (Toast) */}
      {toast.show && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl shadow-xl font-bold text-white text-sm animate-fade-in-down ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">

        {/* هدر صفحه */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-800">مدیریت محصولات</h1>
            <p className="text-gray-500 text-sm mt-1">محصولات خود را اینجا اضافه و مدیریت کنید.</p>
          </div>
          <button
            onClick={() => { resetAddForm(); setShowAddModal(true); }}
            className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-all flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            افزودن محصول جدید
          </button>
        </div>

        {/* لیست محصولات */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

            {/* ✅ نمایش محصولات در حال آپلود (Optimistic) */}
            {pendingProducts.map((pending) => (
              <div key={pending.tempId} className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden flex flex-col relative group">
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl backdrop-blur-sm bg-white/70">
                  {pending.status === 'saving' ? (
                    <><div className="animate-spin rounded-full h-8 w-8 border-t-4 border-b-4 border-indigo-600 mb-2"></div><span className="text-sm font-bold text-indigo-800">در حال ثبت...</span></>
                  ) : (
                    <button onClick={() => handleRetryAdd(pending)} className="flex flex-col items-center text-red-600 hover:scale-105 transition-transform">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-xs font-bold bg-red-50 px-2 py-1 rounded">ثبت نشد (کلیک کنید)</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-col h-full opacity-50">
                  <div className="h-32 bg-white relative border-b border-gray-200 overflow-hidden">
                    {pending.image_url ? <img src={pending.image_url} alt={pending.title} className="w-full h-full object-cover" /> : <div className="flex h-full items-center justify-center text-gray-400 text-xs">بدون عکس</div>}
                  </div>
                  <div className="p-3">
                    <h4 className="font-bold text-gray-800 text-sm truncate">{pending.title}</h4>
                    <div className="mt-2 text-indigo-600 font-bold text-xs">{pending.price.toLocaleString()} تومان</div>
                  </div>
                </div>
              </div>
            ))}

            {/* محصولات واقعی */}
            {products.map((product) => {
              const isProcessing = cardStatus?.id === product.id;

              return (
                <div key={product.id} className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden flex flex-col group relative transition-all duration-300">

                  {isProcessing && (
                    <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl backdrop-blur-sm transition-colors duration-300 ${cardStatus?.state === 'saving' ? 'bg-white/70' : cardStatus?.state === 'success' ? 'bg-green-50/90' : 'bg-red-50/90'}`}>
                      {cardStatus?.state === 'saving' && (<><div className="animate-spin rounded-full h-8 w-8 border-t-4 border-b-4 border-indigo-600 mb-2"></div><span className="text-xs font-bold text-indigo-800">در حال ذخیره...</span></>)}
                      {cardStatus?.state === 'success' && (<><svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span className="text-xs font-bold text-green-700">ذخیره شد</span></>)}
                      {cardStatus?.state === 'error' && (<><svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span className="text-xs font-bold text-red-700">خطا</span></>)}
                    </div>
                  )}

                  <div className={`flex flex-col h-full transition-opacity duration-300 ${isProcessing ? 'opacity-30' : 'opacity-100'}`}>
                    <div className="absolute top-2 left-2 flex gap-1 z-20 transition-opacity duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                      <button onClick={() => openEditModal(product)} disabled={isProcessing} className="bg-white text-blue-600 p-1.5 rounded-lg shadow-sm hover:bg-blue-50 disabled:opacity-50 border border-gray-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                      <button onClick={() => handleDeleteProduct(product.id)} disabled={isProcessing} className="bg-white text-red-600 p-1.5 rounded-lg shadow-sm hover:bg-red-50 disabled:opacity-50 border border-gray-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>

                    <div className="h-32 bg-white relative border-b border-gray-200 overflow-hidden">
                      {product.image_url ? <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" /> : <div className="flex h-full items-center justify-center text-gray-400 text-xs">بدون عکس</div>}
                    </div>

                    <div className="p-3 flex-grow flex flex-col justify-between">
                      <h4 className="font-bold text-gray-800 text-sm truncate pr-16">{product.title}</h4>

                      <div className="mt-1 mb-2">
                        {product.status === 'pending_approval' && <span className="text-[10px] text-orange-600 bg-orange-100 px-2 py-1 rounded-md border border-orange-200 font-bold inline-block">در انتظار تایید</span>}
                        {product.status === 'active' && <span className="text-[10px] text-green-600 bg-green-100 px-2 py-1 rounded-md border border-green-200 font-bold inline-block">تایید شده</span>}
                        {product.status === 'rejected' && <div className="mt-2 text-[10px] bg-red-50 text-red-700 p-2 rounded-lg border border-red-200"><strong className="block mb-1">رد شد:</strong>{product.rejection_reason || 'دلیلی ذکر نشده'}</div>}
                      </div>

                      <div className="mt-auto flex items-center justify-between">
                        <span className="font-bold text-indigo-600 text-sm">{product.price.toLocaleString()} <span className="text-[10px] font-normal text-gray-600">تومان</span></span>
                        <span className="text-[10px] text-gray-600 bg-white px-2 py-1 rounded-md border border-gray-200">موجودی: {product.stock}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ✅ مودال افزودن محصول */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-4xl sm:rounded-3xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-gradient-to-l from-indigo-50 to-white px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></span>
                <div>
                  <h3 className="text-base font-black text-gray-800">افزودن محصول جدید</h3>
                  <p className="text-[11px] text-gray-500">بعد از ثبت، محصول در انتظار تایید قرار می‌گیرد.</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} aria-label="بستن" className="rounded-full p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <form id="addForm" onSubmit={handleAddProduct}>
                <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
                  <ProductFormFields
                    values={addForm}
                    onChange={(field, value) => setAddForm({ ...addForm, [field]: value })}
                    showCategory={true}
                    slots={addForm.addSlots}
                    onSelectImage={handleAddImageSelect}
                    onRemoveImage={handleAddImageRemove}
                    refs={addFileInputRefs}
                  />
                  <aside className="hidden md:block">
                    <div className="sticky top-0">
                      <ProductPreview
                        title={addForm.title}
                        price={addForm.price}
                        discountPrice={addForm.discountPrice}
                        imageUrl={addForm.addSlots[0]?.url}
                        stock={addForm.stock}
                      />
                    </div>
                  </aside>
                </div>
              </form>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3">
              <button onClick={() => setShowAddModal(false)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-100">انصراف</button>
              <button type="submit" form="addForm" className="flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                ثبت محصول
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ مودال ویرایش محصول */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-gradient-to-l from-indigo-50 to-white px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></span>
                <div>
                  <h3 className="text-base font-black text-gray-800">ویرایش محصول</h3>
                  <p className="text-[11px] text-gray-500">بعد از ذخیره، محصول دوباره برای تایید ارسال می‌شود.</p>
                </div>
              </div>
              <button onClick={() => setEditingProduct(null)} aria-label="بستن" className="rounded-full p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <form id="editForm" onSubmit={handleUpdateProduct}>
                <ProductFormFields
                  values={{
                    title: editTitle,
                    price: editPrice,
                    discountPrice: editDiscountPrice,
                    stock: String(editStock ?? ''),
                    category: '',
                    size: editSize,
                    color: editColor,
                    description: editDescription
                  }}
                  onChange={handleEditFieldChange}
                  showCategory={false}
                  slots={editSlots}
                  onSelectImage={handleEditImageSelect}
                  onRemoveImage={handleEditImageRemove}
                  refs={editFileInputRefs}
                />
              </form>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3">
              <button onClick={() => setEditingProduct(null)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-100">انصراف</button>
              <button type="submit" form="editForm" className="flex items-center gap-2 rounded-xl bg-indigo-600 px-7 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                ذخیره تغییرات
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInDown { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .animate-fade-in-down { animation: fadeInDown 0.3s ease-out forwards; }
      `}</style>
    </div>
  )
}
