'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
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

/* ───────── تنظیمات ظاهر و انیمیشن (px / ms) ───────── */
const BAR_H = 64; // ارتفاع ناوبار
const R = 28; // شعاع دایره‌ی شناور
const HOLE_R = 38; // شعاع چاله (هرچه بزرگ‌تر، فاصله‌ی دایره تا لبه‌ی چاله بیشتر)
const FLOAT_Y = -4; // مرکز دایره‌ی شناور نسبت به لبه‌ی بالای ناوبار
const IN_Y = BAR_H / 2; // مرکز دایره وقتی داخل ناوبار فرو رفته
const PAD_TOP = 48; // فضای بالای ناوبار برای دایره و کش آمدن قطره
const FILTER_PAD = 30;
const BLUR = 4; // ۴ تا ۶: هرچه بیشتر، قطره چسبنده‌تر
const DUR = { sink: 260, slide: 240, rise: 460 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const easeInCubic = (t: number) => t * t * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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

  return <TabBar pathname={pathname} />;
}

function TabBar({ pathname }: { pathname: string }) {
  const uid = useId().replace(/:/g, '');
  const n = NAV_ITEMS.length;

  // بررسی فعال بودن تب (برای مسیرهایی که زیرشاخه دارند)
  const isItemActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);
  const activeIndex = NAV_ITEMS.findIndex(({ href }) => isItemActive(href));

  const [width, setWidth] = useState(0);
  const [target, setTarget] = useState(activeIndex);
  const [floatIndex, setFloatIndex] = useState<number | null>(
    activeIndex === -1 ? null : activeIndex
  );
  const [iconIndex, setIconIndex] = useState(Math.max(activeIndex, 0));

  const listRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<SVGEllipseElement>(null);
  const holeRef = useRef<SVGCircleElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  const widthRef = useRef(0);
  const rtlRef = useRef(false);
  const targetRef = useRef(activeIndex);
  const ready = useRef(false);
  const busy = useRef(false);
  const token = useRef(0);
  const st = useRef({ x: 0, y: IN_Y, ry: R, hole: 0, iconOp: 0 });

  // مرکز افقی هر تب (با پشتیبانی از RTL)
  const centerX = useCallback(
    (i: number) => {
      const w = widthRef.current;
      const c = (i + 0.5) * (w / n);
      return rtlRef.current ? w - c : c;
    },
    [n]
  );

  // اعمال مستقیم مقدارها روی DOM (بدون رندر مجدد React در هر فریم)
  const apply = useCallback(() => {
    const s = st.current;
    const c = circleRef.current;
    const h = holeRef.current;
    const ic = iconRef.current;
    if (c) {
      c.setAttribute('cx', String(s.x));
      c.setAttribute('cy', String(PAD_TOP + s.y));
      c.setAttribute('rx', String(R));
      c.setAttribute('ry', String(s.ry));
    }
    if (h) {
      h.setAttribute('cx', String(s.x));
      h.setAttribute('cy', String(PAD_TOP + FLOAT_Y));
      h.setAttribute('r', String(Math.max(s.hole, 0)));
    }
    if (ic) {
      ic.style.transform = `translate(${s.x - 12}px, ${s.y - 12}px)`;
      ic.style.opacity = String(s.iconOp);
    }
  }, []);

  // قرار دادن بدون انیمیشن
  const place = useCallback(
    (i: number) => {
      const s = st.current;
      if (i === -1) {
        s.y = IN_Y;
        s.hole = 0;
        s.iconOp = 0;
        setFloatIndex(null);
      } else {
        s.x = centerX(i);
        s.y = FLOAT_Y;
        s.hole = HOLE_R;
        s.iconOp = 1;
        setFloatIndex(i);
        setIconIndex(i);
      }
      s.ry = R;
      apply();
    },
    [apply, centerX]
  );

  const tween = useCallback(
    (dur: number, fn: (p: number) => void, tk: number) =>
      new Promise<void>((resolve) => {
        const t0 = performance.now();
        const step = (now: number) => {
          if (token.current !== tk) return resolve();
          const p = clamp((now - t0) / dur);
          fn(p);
          apply();
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    [apply]
  );

  const animateTo = useCallback(
    async (to: number) => {
      const tk = ++token.current;
      const s = st.current;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        place(to);
        return;
      }

      busy.current = true;

      // ۱) دایره مثل قطره داخل ناوبار فرو می‌رود و چاله بسته می‌شود
      if (s.y < IN_Y - 0.5) {
        setFloatIndex(null);
        const y0 = s.y;
        const h0 = s.hole;
        const ry0 = s.ry;
        await tween(
          DUR.sink,
          (p) => {
            s.y = lerp(y0, IN_Y, easeInCubic(p));
            s.hole = lerp(h0, 0, easeOutCubic(p));
            s.ry = lerp(ry0, R, p);
            s.iconOp = clamp(1 - p * 2.5);
          },
          tk
        );
        if (token.current !== tk) return;
      }

      if (to === -1) {
        s.hole = 0;
        s.iconOp = 0;
        apply();
        busy.current = false;
        return;
      }

      // ۲) حرکت زیر ناوبار تا تب جدید
      const x0 = s.x;
      const x1 = centerX(to);
      if (Math.abs(x1 - x0) > 0.5) {
        await tween(
          DUR.slide,
          (p) => {
            s.x = lerp(x0, x1, easeInOutCubic(p));
          },
          tk
        );
        if (token.current !== tk) return;
      }
      s.x = x1;

      // ۳) بالا آمدن قطره از زیر ناوبار و باز شدن چاله
      setIconIndex(to);
      setFloatIndex(to);
      await tween(
        DUR.rise,
        (p) => {
          s.y = lerp(IN_Y, FLOAT_Y, easeOutCubic(p));
          s.ry = R + 8 * Math.sin(Math.PI * clamp(p / 0.75));
          s.hole = HOLE_R * easeOutCubic(clamp((p - 0.3) / 0.7));
          s.iconOp = clamp((p - 0.55) / 0.45);
        },
        tk
      );
      if (token.current !== tk) return;

      s.y = FLOAT_Y;
      s.ry = R;
      s.hole = HOLE_R;
      s.iconOp = 1;
      apply();
      busy.current = false;
    },
    [apply, centerX, place, tween]
  );

  // اندازه‌گیری عرض ناوبار و جهت (RTL/LTR)
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    rtlRef.current = getComputedStyle(el).direction === 'rtl';
    const measure = () => {
      widthRef.current = el.clientWidth;
      setWidth(el.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      token.current++;
    };
  }, []);

  // قرار دادن اولیه و تنظیم مجدد هنگام تغییر عرض
  useEffect(() => {
    if (!width) return;
    if (!ready.current) {
      ready.current = true;
      place(targetRef.current);
    } else if (!busy.current) {
      place(targetRef.current);
    }
  }, [width, place]);

  // همگام‌سازی با مسیر واقعی صفحه
  useEffect(() => {
    setTarget(activeIndex);
  }, [activeIndex]);

  // اجرای انیمیشن با تغییر تب
  useEffect(() => {
    targetRef.current = target;
    if (!ready.current) return;
    void animateTo(target);
  }, [target, animateTo]);

  const FloatIcon = NAV_ITEMS[iconIndex].icon;
  const svgH = PAD_TOP + BAR_H;
  const regionW = width + FILTER_PAD * 2;
  const regionH = svgH + FILTER_PAD * 2;

  return (
    <nav className="md:hidden fixed bottom-4 inset-x-4 mx-auto max-w-md z-[9999]">
      <div ref={listRef} className="relative h-16">
        {/* بدنه‌ی سفید + دایره‌ی شناور (افکت قطره با فیلتر goo) */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-0 overflow-visible"
          style={{
            top: -PAD_TOP,
            filter: 'drop-shadow(0 8px 14px rgba(15, 23, 42, 0.16))',
          }}
          width={width}
          height={svgH}
        >
          <defs>
            <filter
              id={`goo-${uid}`}
              filterUnits="userSpaceOnUse"
              x={-FILTER_PAD}
              y={-FILTER_PAD}
              width={regionW}
              height={regionH}
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation={BLUR} result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
              />
            </filter>
            <mask
              id={`hole-${uid}`}
              maskUnits="userSpaceOnUse"
              x={-FILTER_PAD}
              y={-FILTER_PAD}
              width={regionW}
              height={regionH}
            >
              <rect
                x={-FILTER_PAD}
                y={-FILTER_PAD}
                width={regionW}
                height={regionH}
                fill="white"
              />
              <circle ref={holeRef} fill="black" />
            </mask>
          </defs>
          <g filter={`url(#goo-${uid})`}>
            <rect
              x={0}
              y={PAD_TOP}
              width={width}
              height={BAR_H}
              rx={14}
              fill="white"
              mask={`url(#hole-${uid})`}
            />
            <ellipse ref={circleRef} fill="white" />
          </g>
        </svg>

        <ul className="relative z-10 flex h-full">
        {NAV_ITEMS.map(({ href, label, icon: Icon }, index) => {
          const isFloating = floatIndex === index;

          return (
            <li key={href} className="relative flex-1">
              <Link
                href={href}
                aria-label={label}
                aria-current={isItemActive(href) ? 'page' : undefined}
                onClick={() => setTarget(index)}
                className="relative flex h-full w-full flex-col items-center justify-center"
              >
                <Icon
                  className={`h-6 w-6 text-slate-500 transition-opacity duration-200 ${
                    isFloating ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <span
                  className={`absolute bottom-2 whitespace-nowrap text-[11px] font-medium text-slate-700 transition-all duration-300 ${
                    isFloating
                      ? 'translate-y-0 opacity-100 delay-300'
                      : 'translate-y-3 opacity-0'
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
        </ul>

        {/* آیکون داخل دایره‌ی شناور (همراه دایره حرکت می‌کند) */}
        <div
          ref={iconRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-20 text-indigo-500"
          style={{ opacity: 0 }}
        >
          <FloatIcon className="h-6 w-6" strokeWidth={2.5} />
        </div>
      </div>
    </nav>
  );
}