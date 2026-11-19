'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, ShoppingCart, Store, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'خانه', icon: Home },
  { href: '/products', label: 'محصولات', icon: ShoppingBag },
  { href: '/cart', label: 'سبد خرید', icon: ShoppingCart },
  { href: '/stores', label: 'غرفه‌ها', icon: Store },
  { href: '/dashboard', label: 'داشبورد', icon: User },
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

  // بررسی فعال بودن تب (برای مسیرهایی که زیرشاخه دارند)
  const activeIndex = NAV_ITEMS.findIndex(({ href }) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)
  );
  const itemWidth = 100 / NAV_ITEMS.length;
  const pos = activeIndex === -1 ? -50 : (activeIndex + 0.5) * itemWidth;

  return (
    <nav className="md:hidden fixed bottom-4 inset-x-4 mx-auto max-w-md z-[9999] drop-shadow-[0_8px_16px_rgba(15,23,42,0.15)]">
      <ul className="relative flex h-16">
        {/* بدنه‌ی سفید ناوبار با چاله */}
        <span
          aria-hidden="true"
          className="nav-bar-bg absolute inset-0 rounded-xl bg-white"
          style={{ '--pos': `${pos}%` } as CSSProperties}
        />

        {NAV_ITEMS.map(({ href, label, icon: Icon }, index) => {
          const isActive = index === activeIndex;

          return (
            <li key={href} className="relative z-10 flex-1">
              <Link
                href={href}
                aria-label={label}
                className="relative flex h-full w-full flex-col items-center justify-center"
              >
                <Icon
                  className={`h-6 w-6 transition-all duration-300 ${
                    isActive ? '-translate-y-9 text-white' : 'text-slate-500'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className={`absolute bottom-2 whitespace-nowrap text-[11px] font-medium text-slate-700 transition-all duration-300 ${
                    isActive ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}

        {/* دایره‌ی شناور */}
        <li
          aria-hidden="true"
          className={`pointer-events-none absolute -top-8 z-0 flex h-14 justify-center transition-[inset-inline-start,opacity] duration-300 ${
            activeIndex === -1 ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            width: `${itemWidth}%`,
            insetInlineStart: `${Math.max(activeIndex, 0) * itemWidth}%`,
          }}
        >
          <span className="block h-14 w-14 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/40" />
        </li>
      </ul>
    </nav>
  );
}