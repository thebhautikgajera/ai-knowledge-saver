import { memo } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';

const ThemeToggle = memo(({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={[
        'relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-white/80 shadow-sm transition',
        'hover:bg-white/10 hover:text-white',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Sun
        className={[
          'h-4 w-4 transform transition-transform duration-200',
          isDark ? 'scale-0 -rotate-90' : 'scale-100 rotate-0',
        ].join(' ')}
      />
      <Moon
        className={[
          'pointer-events-none absolute h-4 w-4 transform transition-transform duration-200',
          isDark ? 'scale-100 rotate-0' : 'scale-0 rotate-90',
        ].join(' ')}
      />
    </button>
  );
});

ThemeToggle.displayName = 'ThemeToggle';

export default ThemeToggle;

