import { memo } from 'react';

const CinematicLoader = memo(({ label = 'Loading…', sublabel = 'Preparing a cinematic experience…', className = '' }) => {
  return (
    <div className={['flex items-center justify-center p-12', className].join(' ')}>
      <div className="glass-soft rounded-3xl px-6 py-5 text-center">
        <div className="mx-auto mb-3 flex items-center justify-center">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border border-white/12" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[color:var(--color-highlight)] animate-spin" />
            <div className="absolute inset-2 rounded-full bg-white/5" />
          </div>
        </div>
        <p className="text-sm font-semibold text-white/85">{label}</p>
        {sublabel ? <p className="mt-1 text-xs text-white/55">{sublabel}</p> : null}
      </div>
    </div>
  );
});

CinematicLoader.displayName = 'CinematicLoader';

export default CinematicLoader;

