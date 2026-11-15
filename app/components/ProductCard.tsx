'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// آیکون ستاره
const SingleStar = ({ size = "w-3.5 h-3.5" }: { size?: string }) => (
  <svg className={`${size} text-yellow-400`} fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

export default function ProductCard({ 
  product, 
  storeData, 
  isFavorite = false, 
  onToggleFavorite,
  onAddToCart
}: { 
  product: any, 
  storeData?: any, 
  isFavorite?: boolean, 
  onToggleFavorite?: (e: React.MouseEvent, id: string) => void,
  onAddToCart?: (e: React.MouseEvent, product: any) => void
}) {
  const currentStore = storeData || product.stores;
  const router = useRouter();
  
  const [toast, setToast] = useState('')
  
  // محاسبه تخفیف
  let hasDiscount = false;
  let finalPrice = product.price;
  let discountPercent = 0;

  if (currentStore && currentStore.discount_percentage > 0 && currentStore.discount_expires_at) {
    const isActive = new Date(currentStore.discount_expires_at) > new Date();
    const isCategoryMatch = currentStore.discount_category === 'all' || currentStore.discount_category === product.category;
    if (isActive && isCategoryMatch) {
      hasDiscount = true;
      discountPercent = currentStore.discount_percentage;
      finalPrice = product.price - (product.price * (discountPercent / 100));
    }
  }

  // محاسبه امتیاز
  let avgRating = null;
  if (product.reviews && Array.isArray(product.reviews)) {
    const approved = product.reviews.filter((r: any) => r.status === 'approved');
    if (approved.length > 0) {
      avgRating = (approved.reduce((sum: number, r: any) => sum + r.rating, 0) / approved.length).toFixed(1);
    }
  } else if (product.avgRating) {
    avgRating = product.avgRating; 
  }

  // ✅ هندل کردن کلیک روی سبد خرید با چک کردن موجودی
  const handleCartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.stock === 0) {
      setToast('ناموجود است!');
      setTimeout(() => setToast(''), 2000);
      return;
    }

    if (onAddToCart) {
      onAddToCart(e, product);
      setToast('به سبد اضافه شد!')
      setTimeout(() => setToast(''), 2000)
    } else {
      const existingCartString = localStorage.getItem('marketplace_cart')
      let cartData = existingCartString ? JSON.parse(existingCartString) : {}

      const storeKey = currentStore?.id || product.store_id;

      if (!cartData[storeKey]) {
        cartData[storeKey] = { storeName: currentStore?.name, items: [] }
      }

      const existingItemIndex = cartData[storeKey].items.findIndex((item: any) => item.id === product.id)
      if (existingItemIndex > -1) {
        cartData[storeKey].items[existingItemIndex].quantity += 1
      } else {
        cartData[storeKey].items.push({ id: product.id, title: product.title, price: finalPrice, quantity: 1 })
      }

      localStorage.setItem('marketplace_cart', JSON.stringify(cartData))
      
      setToast('به سبد اضافه شد!')
      setTimeout(() => setToast(''), 2000)
    }
  }

  return (
    <div className="relative w-full max-w-[250px] mx-auto group">
      
      {/* ✅ پیام (Toast) */}
      {toast && (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] text-white font-bold px-3 py-1.5 md:px-4 md:py-2 rounded-xl shadow-xl whitespace-nowrap animate-fade-in text-xs md:text-sm ${toast.includes('ناموجود') ? 'bg-red-600' : 'bg-gray-900'}`}>
          {toast}
        </div>
      )}

      {/* بدنه اصلی کارت */}
      <Link 
        href={`/product/${product.id}`} 
        className="block bg-white rounded-[20px] md:rounded-[28px] p-2 md:p-3 shadow-[0_2px_15px_rgb(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 border border-gray-100 relative overflow-visible pb-8 md:pb-10"
      >
        
        {/* کادر عکس */}
        <div className="relative aspect-square bg-gray-50 rounded-[14px] md:rounded-[22px] overflow-hidden w-full flex items-center justify-center">
          
          {/* برچسب تخفیف */}
          {hasDiscount && (
            <div className="absolute top-1.5 right-1.5 md:top-2.5 md:right-2.5 z-20">
              <div className="bg-[#2e7d32] text-white px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-md md:rounded-lg shadow-sm">
                <span className="text-[9px] md:text-[11px] font-black">{discountPercent}٪ تخفیف</span>
              </div>
            </div>
          )}

          {/* برچسب ناموجود */}
          {product.stock === 0 && (
            <div className="absolute top-1.5 right-1.5 md:top-2.5 md:right-2.5 z-20 bg-red-500 text-white px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-md md:rounded-lg shadow-sm">
              <span className="text-[9px] md:text-[11px] font-black">ناموجود</span>
            </div>
          )}

          {/* دکمه علاقه‌مندی */}
          {onToggleFavorite && (
            <button 
              onClick={(e) => onToggleFavorite(e, product.id)} 
              className={`absolute top-1.5 left-1.5 md:top-2.5 md:left-2.5 z-20 w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full transition-all shadow-sm ${isFavorite ? 'bg-white text-red-500' : 'bg-white/90 text-gray-400 hover:bg-white hover:text-red-400'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 md:h-4 md:w-4 ${isFavorite ? 'fill-red-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          )}

          {/* عکس محصول */}
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.title} 
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${product.stock === 0 ? 'grayscale opacity-60' : ''}`} 
            />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 md:h-12 md:w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2v12a2 2 0 002 2z" />
            </svg>
          )}
        </div>
        
        {/* بخش اطلاعات */}
        <div className="pt-2 md:pt-3.5 px-0.5 md:px-1">
          <h4 className="font-bold text-gray-800 text-[12px] md:text-[15px] text-right w-full truncate leading-tight">
            {product.title}
          </h4>
          <p className="text-[10px] md:text-[11px] text-gray-500 text-right w-full truncate mt-0.5 md:mt-1">
            {currentStore?.name}
          </p>
          
          {/* ردیف پایین: ستاره + دکمه + قیمت */}
          <div className="w-full flex items-center justify-between mt-3 md:mt-5 relative">
            
            {/* ستاره و امتیاز (سمت چپ) */}
            <div className="flex items-center gap-0.5 md:gap-1 flex-1 justify-start">
              {avgRating && (
                <>
                  <SingleStar size="w-3 h-3 md:w-4 md:h-4" />
                  <span className="text-[11px] md:text-[13px] text-gray-700 font-bold">{avgRating}</span>
                </>
              )}
            </div>

            {/* فضای خالی وسط برای دکمه شناور */}
            <div className="w-10 md:w-16"></div>

            {/* قیمت (سمت راست) */}
            <div className="flex flex-col items-end flex-1">
              {hasDiscount ? (
                <>
                  <span className="text-[10px] md:text-[12px] text-red-500 line-through font-medium">
                    {product.price.toLocaleString()}
                  </span>
                  <span className="font-black text-gray-900 text-[12px] md:text-[15px] leading-none">
                    {finalPrice.toLocaleString()}
                    <span className="text-[8px] md:text-[10px] font-medium text-gray-500 mr-0.5 md:mr-1">تومان</span>
                  </span>
                </>
              ) : product.discount_price ? (
                <>
                  <span className="text-[10px] md:text-[12px] text-red-500 line-through font-medium">
                    {product.price.toLocaleString()}
                  </span>
                  <span className="font-black text-gray-900 text-[12px] md:text-[15px] leading-none">
                    {product.discount_price.toLocaleString()}
                    <span className="text-[8px] md:text-[10px] font-medium text-gray-500 mr-0.5 md:mr-1">تومان</span>
                  </span>
                </>
              ) : (
                <span className="font-black text-gray-900 text-[12px] md:text-[15px] leading-none">
                  {product.price.toLocaleString()}
                  <span className="text-[8px] md:text-[10px] font-medium text-gray-500 mr-0.5 md:mr-1">تومان</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* ✅ دکمه سبد خرید شناور (سایز کوچک‌تر در موبایل) */}
      <button 
        onClick={handleCartClick}
        className={`absolute bottom-2 md:bottom-3 left-1/2 -translate-x-1/2 translate-y-1/2 w-11 h-11 md:w-16 md:h-16 rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(0,0,0,0.15)] md:shadow-[0_8px_25px_rgba(0,0,0,0.18)] border border-gray-100 transition-all duration-300 z-30 ${
          product.stock === 0 
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
            : 'bg-white text-gray-800 hover:bg-gray-900 hover:text-white'
        }`}
        title={product.stock === 0 ? "ناموجود" : "افزودن به سبد خرید"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </button>

      {/* انیمیشن برای Toast */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -30%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}