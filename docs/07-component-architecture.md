# 7. Component Architecture

## المبدأ
Design System موحّد يخدم كل الأحجام: Mobile-First، حدود Logical (RTL/LTR)، حالات متسقة.

## هرم المكونات
```
Design Tokens (colors, type, radii, spacing, shadows)
   ↓
Primitives (ui/*): Button, Input, Select, Card, Badge, Table,
                   Dialog, Tabs, Dropdown, Alert, Toast, Skeleton,
                   EmptyState, ErrorState, Avatar, Tooltip, Progress
   ↓
Layout: AppShell, Sidebar, TopBar, BottomNav, Drawer, PageHeader, Grid
   ↓
Domain: PatientHeader, VitalsPanel, BloodPressureChart, StatusBadge,
        PatientRow/Card, StatsCard, ActivityList, Timeline
   ↓
Features → Pages → Routes
```

## قواعد
1. **Primitives بدون منطق أعمال** — تستهلك props فقط، وتدعم `dir` تلقائياً.
2. **التسمية**: `components/ui/<name>.tsx` (طبعي + type-safe عبر TypeScript).
3. **التخصيص**: كل Primal يدعم `className` وقيم token (مثل `size`, `variant`).
4. **التجاوب**: بُنى grid/table responsive؛ الجداول تتحول إلى Cards على < 640px.
5. **حالات كل مكوّن**: loading / empty / error / success.
6. **i18n**: لا نصوص مضمّنة — تُستخدم `useTranslation()` في كل المكونات.
7. **RTL**: استخدام `ms/me/ps/pe` و `start/end` و `text-start/end` فقط.

## أمثلة معمارية
- `DataTable` (< 640px): يعرض `TableRowCards`.
- `Tabs` في Patient Chart: أفقية قابلة للتمرير على الموبايل، ممتدة على Desktop.
- `AppShell`: `useMediaQuery` → تبني Sidebar/Drawer/BottomNav حسب النطاق.