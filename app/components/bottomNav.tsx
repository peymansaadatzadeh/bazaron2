
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, ShoppingCart, Store, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',          label: 'خانه',       icon: Home },
  { href: '/products',  label: 'محصولات',    icon: ShoppingBag },
  { href: '/cart',      label: 'سبد خرید',   icon: ShoppingCart },
  { href: '/stores',    label: 'غرفه‌ها',    icon: Store },
  { href: '/dashboard', label: 'داشبورد',    icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  // مخفی کردن منوی پایین در پنل‌های مدیریتی
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard/store-panel') ||
    pathname.startsWith('/courier')
  ) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-4 inset-x-4 mx-auto max-w-md z-[9999]">
      <div className="bg-slate-100 rounded-[1.25rem] p-2 flex justify-around items-center shadow-[6px_6px_16px_#cbd5e1,-6px_-6px_16px_#ffffff]">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          // بررسی فعال بودن تب (برای مسیرهایی که زیرشاخه دارند)
          const isActive = href === '/'
            ? pathname === '/'
            : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`relative flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-2xl transition-all duration-300 bg-slate-100 ${
                isActive
                  ? 'shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff] text-indigo-500 scale-[0.92]'
                  : 'shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] text-slate-400 hover:text-slate-500'
              }`}
            >
              <Icon
                className="w-5 h-5"
                strokeWidth={isActive ? 2.5 : 2}
              />

              <span className="text-[10px] leading-none font-medium whitespace-nowrap">
                {label}
              </span>

              {isActive && (
                <span className="absolute -bottom-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pop-in" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
