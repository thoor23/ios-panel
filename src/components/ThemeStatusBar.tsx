import { useEffect } from 'react';
import { useTheme } from 'next-themes';

const THEME_COLORS = {
  light: '#e8dff5',
  dark: '#1a1225',
} as const;

/** Syncs status bar (theme-color + iOS apple-mobile-web-app-status-bar-style) with app theme. */
export function ThemeStatusBar() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const isDark = resolvedTheme === 'dark';
    const color = resolvedTheme ? THEME_COLORS[resolvedTheme as keyof typeof THEME_COLORS] : THEME_COLORS.light;
    const appleStyle = isDark ? 'black-translucent' : 'default';

    const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.content = color;
      themeColorMeta.removeAttribute('media');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
    }

    let appleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!appleMeta) {
      appleMeta = document.createElement('meta');
      appleMeta.name = 'apple-mobile-web-app-status-bar-style';
      document.head.appendChild(appleMeta);
    }
    appleMeta.content = appleStyle;
  }, [resolvedTheme]);

  return null;
}
