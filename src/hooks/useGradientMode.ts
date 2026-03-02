import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTheme } from 'next-themes';

const STORAGE_KEY_MODE = 'nextios_gradient_mode';
const STORAGE_KEY_RANDOM_LIGHT = 'nextios_random_gradient_light';
const STORAGE_KEY_RANDOM_DARK = 'nextios_random_gradient_dark';

export type GradientMode = 'gradient' | 'no-gradient' | 'random';

function generateRandomGradient(isDark: boolean): string {
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const hue = () => Math.floor(rand(0, 360));
  if (isDark) {
    const darkOrb = (h: number) => `hsl(${h} 50% ${rand(12, 22)}% / ${rand(0.4, 0.65)})`;
    const base = (h: number) => `hsl(${h} 45% ${rand(14, 20)}%)`;
    const h1 = hue(), h2 = hue(), h3 = hue(), h4 = hue(), h5 = hue(), h6 = hue();
    return [
      `radial-gradient(ellipse at 0% 0%, ${darkOrb(h1)} 0%, transparent 45%)`,
      `radial-gradient(ellipse at 100% 0%, ${darkOrb(h2)} 0%, transparent 45%)`,
      `radial-gradient(ellipse at 50% 100%, ${darkOrb(h3)} 0%, transparent 50%)`,
      `radial-gradient(ellipse at 80% 60%, ${darkOrb(h4)} 0%, transparent 40%)`,
      `linear-gradient(135deg, ${base(h5)} 0%, ${base(h6)} 100%)`,
    ].join(', ');
  }
  const lightOrb = (h: number) => `hsl(${h} 70% ${rand(82, 94)}% / ${rand(0.35, 0.6)})`;
  const base = (h: number) => `hsl(${h} 55% ${rand(96, 99)}%)`;
  const h1 = hue(), h2 = hue(), h3 = hue(), h4 = hue(), h5 = hue(), h6 = hue();
  return [
    `radial-gradient(ellipse at 0% 0%, ${lightOrb(h1)} 0%, transparent 45%)`,
    `radial-gradient(ellipse at 100% 0%, ${lightOrb(h2)} 0%, transparent 45%)`,
    `radial-gradient(ellipse at 50% 100%, ${lightOrb(h3)} 0%, transparent 50%)`,
    `radial-gradient(ellipse at 80% 60%, ${lightOrb(h4)} 0%, transparent 40%)`,
    `linear-gradient(135deg, ${base(h5)} 0%, ${base(h6)} 100%)`,
  ].join(', ');
}

export function useGradientMode() {
  const { resolvedTheme } = useTheme();
  const [gradientMode, setGradientModeState] = useState<GradientMode>(() =>
    (typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_MODE) as GradientMode) : null) || 'no-gradient'
  );
  const [randomGradientLight, setRandomGradientLight] = useState<string>('');
  const [randomGradientDark, setRandomGradientDark] = useState<string>('');

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY_MODE) as GradientMode) || 'no-gradient';
    setGradientModeState(stored);
    if (stored === 'random') {
      const savedLight = localStorage.getItem(STORAGE_KEY_RANDOM_LIGHT);
      const savedDark = localStorage.getItem(STORAGE_KEY_RANDOM_DARK);
      setRandomGradientLight(savedLight || generateRandomGradient(false));
      setRandomGradientDark(savedDark || generateRandomGradient(true));
    }
  }, []);

  useEffect(() => {
    if (gradientMode !== 'random') return;
    if (randomGradientLight) localStorage.setItem(STORAGE_KEY_RANDOM_LIGHT, randomGradientLight);
    if (randomGradientDark) localStorage.setItem(STORAGE_KEY_RANDOM_DARK, randomGradientDark);
  }, [gradientMode, randomGradientLight, randomGradientDark]);

  useEffect(() => {
    document.documentElement.setAttribute('data-gradient-mode', gradientMode);
  }, [gradientMode]);

  const setGradientMode = useCallback((mode: GradientMode) => {
    if (mode === 'random') {
      const light = generateRandomGradient(false);
      const dark = generateRandomGradient(true);
      localStorage.setItem(STORAGE_KEY_RANDOM_LIGHT, light);
      localStorage.setItem(STORAGE_KEY_RANDOM_DARK, dark);
      setRandomGradientLight(light);
      setRandomGradientDark(dark);
    }
    localStorage.setItem(STORAGE_KEY_MODE, mode);
    setGradientModeState(mode);
  }, []);

  const isDark = resolvedTheme === 'dark';
  const randomGradient = isDark ? randomGradientDark : randomGradientLight;

  const dashboardProps = useMemo((): { className: string; style?: React.CSSProperties } => {
    const baseClass = 'min-h-screen min-h-[100dvh] flex flex-col w-full';
    if (gradientMode === 'gradient') {
      return { className: `${baseClass} dashboard-gradient` };
    }
    if (gradientMode === 'no-gradient') {
      return { className: `${baseClass} bg-background` };
    }
    const grad = randomGradient;
    if (!grad) {
      return { className: `${baseClass} dashboard-gradient` };
    }
    return { className: baseClass, style: { background: grad } };
  }, [gradientMode, randomGradient]);

  return { gradientMode, setGradientMode, dashboardProps };
}
