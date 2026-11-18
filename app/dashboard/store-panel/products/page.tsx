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

  const uploadImage = async (file: File) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${storeId}/${fileName}`
    const { error } = await supabase.storage.from('product-images').upload(filePath, file)
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

  const ImageSlotsGrid = ({ slots, onSelect, onRemove, refs }: { slots: ImageSlot[], onSelect: any, onRemove: any, refs: any }) => {
    return (
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="col-span-2 relative h-32 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden hover:bg-gray-100 transition-colors cursor-pointer group">
          <input type="file" accept="image/*" onChange={(e) => onSelect(0, e)} ref={el => { refs.current[0] = el }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
          {slots[0] ? (
            <>
              <img src={slots[0].url} alt="Cover" className="w-full h-full object-cover" />
              <button type="button" onClick={(e) => { e.preventDefault(); onRemove(0); }} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              <span className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">عکس کاور</span>
            </>
          ) : (
            <div className="flex flex-col items-center text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span className="text-xs font-bold">افزودن عکس کاور</span>
            </div>
          )}
        </div>

        {[1, 2, 3, 4].map((index) => (
          <div key={index} className="relative h-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden hover:bg-gray-100 transition-colors cursor-pointer group">
            <input type="file" accept="image/*" onChange={(e) => onSelect(index, e)} ref={el => { refs.current[index] = el }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            {slots[index] ? (
              <>
                <img src={slots[index]!.url} alt={`Slot ${index}`} className="w-full h-full object-cover" />
                <button type="button" onClick={(e) => { e.preventDefault(); onRemove(index); }} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-20"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            )}
          </div>
        ))}
      </div>
    )
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gray-50 p-4 border-b flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-gray-800">افزودن محصول جدید</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="addForm" onSubmit={handleAddProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">نام محصول *</label>
                    <input type="text" value={addForm.title} onChange={(e) => setAddForm({...addForm, title: e.target.value})} required className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-gray-800" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">قیمت اصلی *</label>
                    <input type="text" inputMode="numeric" value={addForm.price} onChange={(e) => setAddForm({...addForm, price: formatPrice(e.target.value)})} required className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-left text-gray-800" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">قیمت با تخفیف</label>
                    <input type="text" inputMode="numeric" value={addForm.discountPrice} onChange={(e) => setAddForm({...addForm, discountPrice: formatPrice(e.target.value)})} className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-left text-green-600 font-bold" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">موجودی *</label>
                    <input type="number" value={addForm.stock} onChange={(e) => setAddForm({...addForm, stock: e.target.value})} required className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-left text-gray-800" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">دسته‌بندی</label>
                    <input type="text" value={addForm.category} onChange={(e) => setAddForm({...addForm, category: e.target.value})} className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-gray-800" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">سایز</label>
                    <input type="text" value={addForm.size} onChange={(e) => setAddForm({...addForm, size: e.target.value})} className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-gray-800" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">رنگ</label>
                    <input type="text" value={addForm.color} onChange={(e) => setAddForm({...addForm, color: e.target.value})} className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-gray-800" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">گالری عکس‌ها</label>
                    <ImageSlotsGrid slots={addForm.addSlots} onSelect={handleAddImageSelect} onRemove={handleAddImageRemove} refs={addFileInputRefs} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">توضیحات</label>
                    <textarea value={addForm.description} onChange={(e) => setAddForm({...addForm, description: e.target.value})} rows={3} className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-gray-800"></textarea>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 shrink-0">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-700 font-bold hover:bg-gray-200 rounded-xl transition-colors">انصراف</button>
              <button type="submit" form="addForm" className="bg-indigo-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors">ثبت محصول</button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ مودال ویرایش محصول */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gray-50 p-4 border-b flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-gray-800">ویرایش محصول</h3>
              <button onClick={() => setEditingProduct(null)} className="text-gray-500 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="editForm" onSubmit={handleUpdateProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">گالری عکس‌ها</label>
                    <ImageSlotsGrid slots={editSlots} onSelect={handleEditImageSelect} onRemove={handleEditImageRemove} refs={editFileInputRefs} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">نام محصول</label>
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-gray-800" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">قیمت اصلی</label>
                    <input type="text" inputMode="numeric" value={editPrice} onChange={(e) => setEditPrice(formatPrice(e.target.value))} required className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-left text-gray-800" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">قیمت با تخفیف</label>
                    <input type="text" inputMode="numeric" value={editDiscountPrice} onChange={(e) => setEditDiscountPrice(formatPrice(e.target.value))} className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-left text-green-600 font-bold" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">موجودی</label>
                    <input type="number" value={editStock} onChange={(e) => setEditStock(e.target.value)} required className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-left text-gray-800" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">سایز</label>
                    <input type="text" value={editSize} onChange={(e) => setEditSize(e.target.value)} className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-gray-800" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">رنگ</label>
                    <input type="text" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-gray-800" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">توضیحات</label>
                    <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} className="w-full bg-gray-50 px-4 py-2 border border-gray-300 rounded-xl text-gray-800"></textarea>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 shrink-0">
              <button onClick={() => setEditingProduct(null)} className="px-4 py-2 text-gray-700 font-bold hover:bg-gray-200 rounded-xl transition-colors">انصراف</button>
              <button type="submit" form="editForm" className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors">ذخیره تغییرات</button>
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