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

  const activeIndex = NAV_ITEMS.findIndex(({ href }) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)
  );

  // محاسبه موقعیت indicator مخصوص RTL
  // در RTL آیتم‌ها از راست به چپ چیده می‌شن، پس باید از سمت راست حساب کنیم
  const indicatorPosition = `calc(${activeIndex} * 70px + ${activeIndex} * 12px)`;

  return (
    <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[360px] max-w-[92vw]" dir="rtl">
      <div className="relative h-[70px] bg-white rounded-[10px] px-5 flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
        <ul className="list-none flex justify-between w-full relative">
          {NAV_ITEMS.map(({ href, label, icon: Icon }, index) => {
            const isActive =
              href === '/' ? pathname === '/' : pathname.startsWith(href);

            return (
              <li
                key={href}
                className={`relative z-10 w-[70px] h-[70px] ${isActive ? 'active' : ''}`}
              >
                <Link
                  href={href}
                  aria-label={label}
                  className="relative flex flex-col items-center justify-center w-full h-full no-underline"
                >
                  {/* Icon */}
                  <span
                    className={`
                      relative flex items-center justify-center
                      transition-all duration-500 ease-out
                      ${isActive
                        ? 'text-white -translate-y-[32px]'
                        : 'text-[#1D1C1D] translate-y-0'
                      }
                    `}
                  >
                    <Icon
                      className="w-[22px] h-[22px]"
                      strokeWidth={isActive ? 2.4 : 2}
                    />
                  </span>

                  {/* Label */}
                  <span
                    className={`
                      absolute text-[11px] font-medium tracking-wide
                      transition-all duration-500 ease-out
                      ${isActive
                        ? 'opacity-100 translate-y-[10px] text-[#1D1C1D]'
                        : 'opacity-0 translate-y-[20px] text-[#1D1C1D]'
                      }
                    `}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}

          {/* Indicator */}
          <li
            className="absolute top-[-50%] w-[70px] h-[70px] rounded-full border-[6px] border-white bg-[#E0155A] transition-all duration-300 ease-out z-0 pointer-events-none shadow-[0_4px_12px_rgba(224,21,90,0.35)]"
            style={{
              // در RTL از right استفاده می‌کنیم
              right: indicatorPosition,
              left: 'auto',
            }}
          >
            {/* منحنی‌های کناری */}
            <span className="absolute top-1/2 -left-[22px] w-5 h-5 bg-transparent shadow-[1px_-10px_0_0_#ffffff] rounded-tr-[20px]" />
            <span className="absolute top-1/2 -right-[22px] w-5 h-5 bg-transparent shadow-[-1px_-10px_0_0_#ffffff] rounded-tl-[20px]" />
          </li>
        </ul>
      </div>
    </nav>
  );
}