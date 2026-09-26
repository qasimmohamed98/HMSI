/** اسم مختصر للجهاز من نص المتصفح: «Windows · Chrome»، «Android (SM-A546E) · Chrome»… */
export function deviceLabel(ua: string | null | undefined): string {
  const u = ua ?? '';
  const model = u.match(/Android [\d.]+; (?:[a-z]{2}[-_][a-z]{2}; )?([^;)]+?)(?: Build\/|\))/i)?.[1]?.trim();
  const os = /android/i.test(u)
    ? `Android${model && model !== 'K' ? ` (${model})` : ''}`
    : /iphone/i.test(u)
      ? 'iPhone'
      : /ipad/i.test(u)
        ? 'iPad'
        : /windows/i.test(u)
          ? 'Windows'
          : /mac os/i.test(u)
            ? 'Mac'
            : /linux/i.test(u)
              ? 'Linux'
              : '—';
  const br = /edg\//i.test(u) ? 'Edge' : /samsungbrowser/i.test(u) ? 'Samsung' : /firefox|fxios/i.test(u) ? 'Firefox' : /chrome|crios/i.test(u) ? 'Chrome' : /safari/i.test(u) ? 'Safari' : '—';
  // التطبيق المثبّت (PWA) يرسل نص المتصفح نفسه — لا نميّزه هنا
  return `${os} · ${br}`;
}
