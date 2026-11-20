'use client'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

// ✅ کامپوننت داخلی که از هوک‌های کلاینت استفاده می‌کند
function NavbarContent() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const pathname = usePathname() // این هوک نیاز به Suspense دارد

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
    }
    fetchSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // مخفی کردن نوار بالای سایت در پنل‌ها
  if (
    pathname.startsWith('/dashboard') || 
    pathname.startsWith('/admin') || 
    pathname.startsWith('/courier')
  ) {
    return null
  }

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          <div className="flex items-center gap-6">
            <Link href="/" className="text-2xl font-black text-bg-rose-600">بازاران</Link>
            <div className="hidden md:flex gap-4 font-medium text-gray-600">
              <Link href="/products" className="hover:text-red-600">محصولات</Link>
              <Link href="/stores" className="hover:text-red-600">غرفه‌ها</Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/cart" className="text-gray-600 hover:text-red-600 font-bold flex items-center gap-1">
              سبد خرید
            </Link>

            {user ? (
              <div className="flex items-center gap-3">
                <Link href="/dashboard" className="text-sm font-bold text-red-600 bg-red-50 px-4 py-2 rounded-xl">داشبورد</Link>
                <button onClick={handleLogout} className="text-sm font-bold text-red-600 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100">خروج</button>
              </div>
            ) : (
              <Link href="/login" className="text-sm font-bold text-white bg-red-600 px-6 py-2 rounded-xl hover:bg-red-700">ورود / ثبت‌نام</Link>
            )}
          </div>

        </div>
      </div>
    </nav>
  )
}

// ✅ خروجی نهایی که کامپوننت را داخل Suspense می‌پیچد تا Vercel ارور ندهد
export default function Navbar() {
  return (
    <Suspense fallback={null}>
      <NavbarContent />
    </Suspense>
  )
}