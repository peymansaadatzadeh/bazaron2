'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
const BAR_H = 68; // ارتفاع ناوبار
const CORNER = 16; // گردی گوشه‌ها
const DENT_D = 16; // عمق فرورفتگی
const DENT_HALF_MAX = 28; // نصف عرض فرورفتگی (حداکثر)
const DOT_R = 6; // شعاع نقطه
const DOT_REST_Y = 3; // مرکز نقطه‌ی نشسته، نسبت به لبه‌ی بالای ناوبار
const DOT_COLOR = '#b5b5b5'; // indigo-500 (هم‌رنگ آیکون فعال)
const PAD_TOP = 64; // فضای بالای ناوبار برای پرش نقطه
const JUMP_BASE = 30; // ارتفاع پرش
const JUMP_PER_TAB = 6; // ارتفاع اضافه به‌ازای هر تب فاصله
const FLIGHT_MS = 380;
const FLIGHT_PER_TAB_MS = 40;
const SETTLE_MS = 160;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

type Dent = { x: number; depth: number };

// شکل نرم فرورفتگی (۱ در مرکز، ۰ در لبه‌ها)
const profile = (u: number) => {
  const a = Math.pow(Math.min(Math.abs(u), 1), 0.85);
  return 1 - a * a * (3 - 2 * a);
};

// ساخت مسیر بدنه‌ی ناوبار با فرورفتگی‌ها
function buildPath(w: number, dents: Dent[], halfW: number) {
  const top = PAD_TOP;
  const bottom = PAD_TOP + BAR_H;
  const r = CORNER;
  const live = dents.filter((d) => d.depth > 0.05);

  let d = `M 0 ${top + r} Q 0 ${top} ${r} ${top}`;
  if (live.length === 0) {
    d += ` L ${w - r} ${top}`;
  } else {
    const yAt = (x: number) => {
      let off = 0;
      for (const k of live) {
        const u = (x - k.x) / halfW;
        if (Math.abs(u) < 1) off += k.depth * profile(u);
      }
      return top + Math.min(off, DENT_D);
    };
    for (let x = r; x < w - r; x += 3) d += ` L ${x} ${yAt(x).toFixed(2)}`;
    d += ` L ${w - r} ${yAt(w - r).toFixed(2)}`;
  }
  d += ` Q ${w} ${top} ${w} ${top + r} L ${w} ${bottom - r} Q ${w} ${bottom} ${w - r} ${bottom}`;
  d += ` L ${r} ${bottom} Q 0 ${bottom} 0 ${bottom - r} Z`;
  return d;
}

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
  const n = NAV_ITEMS.length;

  // بررسی فعال بودن تب (برای مسیرهایی که زیرشاخه دارند)
  const isItemActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);
  const activeIndex = NAV_ITEMS.findIndex(({ href }) => isItemActive(href));

  const [width, setWidth] = useState(0);
  const [target, setTarget] = useState(activeIndex);
  const [settledIndex, setSettledIndex] = useState<number | null>(
    activeIndex === -1 ? null : activeIndex
  );

  const boxRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGEllipseElement>(null);

  const widthRef = useRef(0);
  const rtlRef = useRef(false);
  const targetRef = useRef(activeIndex);
  const ready = useRef(false);
  const busy = useRef(false);
  const token = useRef(0);
  const st = useRef({
    dotX: 0,
    dotY: DOT_REST_Y,
    rx: DOT_R,
    ry: DOT_R,
    op: 0,
    dents: [] as Dent[],
  });

  // مرکز افقی هر تب (با پشتیبانی از RTL)
  const centerX = useCallback(
    (i: number) => {
      const w = widthRef.current;
      const c = (i + 0.5) * (w / n);
      return rtlRef.current ? w - c : c;
    },
    [n]
  );

  const apply = useCallback(() => {
    const s = st.current;
    const w = widthRef.current;
    const halfW = Math.min((w / n) * 0.34, DENT_HALF_MAX);
    const p = pathRef.current;
    const dot = dotRef.current;
    if (p) p.setAttribute('d', buildPath(w, s.dents, halfW));
    if (dot) {
      dot.setAttribute('cx', String(s.dotX));
      dot.setAttribute('cy', String(PAD_TOP + s.dotY));
      dot.setAttribute('rx', String(s.rx));
      dot.setAttribute('ry', String(s.ry));
      dot.setAttribute('opacity', String(s.op));
    }
  }, [n]);

  // قرار دادن بدون انیمیشن
  const place = useCallback(
    (i: number) => {
      const s = st.current;
      s.rx = DOT_R;
      s.ry = DOT_R;
      s.dotY = DOT_REST_Y;
      if (i === -1) {
        s.dents = [];
        s.op = 0;
        setSettledIndex(null);
      } else {
        s.dotX = centerX(i);
        s.dents = [{ x: s.dotX, depth: DENT_D }];
        s.op = 1;
        setSettledIndex(i);
      }
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
      setSettledIndex(null); // آیکون قبلی همان لحظه خاکستری می‌شود

      const tabW = widthRef.current / n;
      const oldDents = s.dents.map((d) => ({ ref: d, from: d.depth }));

      // رفتن به «بدون تب فعال»: نقطه بالا می‌پرد و محو می‌شود
      if (to === -1) {
        const y0 = s.dotY;
        await tween(
          260,
          (p) => {
            oldDents.forEach(({ ref, from }) => {
              ref.depth = from * (1 - easeOutCubic(p));
            });
            s.dotY = y0 - 28 * easeOutCubic(p);
            s.op = 1 - p;
          },
          tk
        );
        if (token.current !== tk) return;
        s.dents = [];
        s.op = 0;
        apply();
        busy.current = false;
        return;
      }

      const x1 = centerX(to);
      const fresh = s.op < 0.5; // نقطه‌ای نبوده؛ از بالا می‌افتد
      const fromX = fresh ? x1 : s.dotX;
      const y0 = fresh ? -40 : s.dotY;
      const dist = Math.abs(x1 - fromX) / tabW;
      const jump = JUMP_BASE + Math.min(dist, 4) * JUMP_PER_TAB;
      const dur = FLIGHT_MS + Math.min(dist, 4) * FLIGHT_PER_TAB_MS;
      const op0 = s.op;

      const newDent: Dent = { x: x1, depth: 0 };
      s.dents = [...s.dents, newDent];

      // ۱) فرورفتگی قبلی بسته می‌شود، نقطه در یک مسیر کمانی می‌پرد،
      //    پیش از رسیدن، فرورفتگی جدید باز می‌شود
      let colored = false;
      await tween(
        dur,
        (p) => {
          oldDents.forEach(({ ref, from }) => {
            ref.depth = from * (1 - easeOutCubic(clamp(p / 0.25)));
          });
          newDent.depth = DENT_D * easeOutCubic(clamp((p - 0.45) / 0.5));

          s.dotX = lerp(fromX, x1, easeInOutSine(p));
          s.dotY = lerp(y0, DOT_REST_Y, p) - 4 * jump * p * (1 - p);
          s.op = lerp(op0, 1, clamp(p * 4));

          if (!colored && p > 0.8) {
            colored = true;
            setSettledIndex(to);
          }
        },
        tk
      );
      if (token.current !== tk) return;

      // ۲) نشستن نقطه با یک له‌شدگی کوچک
      s.dents = [newDent];
      newDent.depth = DENT_D;
      await tween(
        SETTLE_MS,
        (p) => {
          const k = Math.sin(Math.PI * p);
          s.dotY = DOT_REST_Y + 2 * k;
          s.rx = DOT_R * (1 + 0.25 * k);
          s.ry = DOT_R * (1 - 0.25 * k);
        },
        tk
      );
      if (token.current !== tk) return;

      s.dotX = x1;
      s.dotY = DOT_REST_Y;
      s.rx = DOT_R;
      s.ry = DOT_R;
      s.op = 1;
      apply();
      busy.current = false;
    },
    [apply, centerX, n, place, tween]
  );

  // اندازه‌گیری عرض ناوبار و جهت (RTL/LTR)
  useEffect(() => {
    const el = boxRef.current;
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

  const svgH = PAD_TOP + BAR_H;

  return (
    <nav className="md:hidden fixed bottom-4 inset-x-4 mx-auto max-w-md z-[9999]">
      <div ref={boxRef} className="relative" style={{ height: BAR_H }}>
        {/* بدنه‌ی سفید با فرورفتگی + نقطه‌ی پرنده */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-0 overflow-visible"
          style={{
            top: -PAD_TOP,
            filter: 'drop-shadow(0 8px 14px rgba(15, 23, 42, 0.14))',
          }}
          width={width}
          height={svgH}
        >
          <path ref={pathRef} fill="white" />
          <ellipse ref={dotRef} fill={DOT_COLOR} opacity={0} />
        </svg>

        <ul className="relative z-10 flex h-full">
          {NAV_ITEMS.map(({ href, label, icon: Icon }, index) => {
            const isSettled = settledIndex === index;

            return (
              <li key={href} className="relative flex-1">
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={isItemActive(href) ? 'page' : undefined}
                  onClick={() => setTarget(index)}
                  className="flex h-full w-full flex-col items-center justify-end pb-[9px]"
                >
                  <Icon
                    className={`h-[22px] w-[22px] transition-all duration-300 ${
                      isSettled
                        ? '-translate-y-0.5 scale-110 text-indigo-500'
                        : 'text-slate-400'
                    }`}
                    strokeWidth={isSettled ? 2.4 : 2}
                  />
                  <span
                    className={`mt-[3px] whitespace-nowrap text-[10px] font-medium leading-3 transition-colors duration-300 ${
                      isSettled ? 'text-indigo-500' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}