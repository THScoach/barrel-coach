/**
 * Reusable page-level skeleton loaders for the Player V2 portal.
 * Each variant mirrors the real layout of its page.
 */

function ShimmerBlock({ className = '', height = 'h-20' }: { className?: string; height?: string }) {
  return (
    <div
      className={`rounded-2xl ${height} ${className}`}
      style={{
        background: 'linear-gradient(90deg, #111 25%, #1a1a1a 50%, #111 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
      }}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>
      <ShimmerBlock height="h-14" className="rounded-none" />
      <div className="p-4 space-y-3">
        <ShimmerBlock height="h-52" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => <ShimmerBlock key={i} height="h-20" />)}
        </div>
        <ShimmerBlock height="h-24" />
        <ShimmerBlock height="h-32" />
      </div>
    </div>
  );
}

export function DataSkeleton() {
  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>
      <ShimmerBlock height="h-14" className="rounded-none" />
      <div className="px-4 pt-2 pb-4 flex gap-4">
        {[1, 2, 3, 4].map(i => <ShimmerBlock key={i} height="h-8" className="w-20" />)}
      </div>
      <div className="px-4 space-y-3">
        <ShimmerBlock height="h-60" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => <ShimmerBlock key={i} height="h-20" />)}
        </div>
      </div>
    </div>
  );
}

export function SessionSkeleton() {
  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>
      <ShimmerBlock height="h-14" className="rounded-none" />
      <div className="p-4 space-y-3">
        <ShimmerBlock height="h-8" className="w-48" />
        <ShimmerBlock height="h-2" />
        {[1, 2, 3].map(i => <ShimmerBlock key={i} height="h-36" />)}
      </div>
    </div>
  );
}

export function ProgressSkeleton() {
  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>
      <ShimmerBlock height="h-14" className="rounded-none" />
      <div className="p-4 space-y-3">
        <ShimmerBlock height="h-28" />
        <ShimmerBlock height="h-64" />
        <ShimmerBlock height="h-40" />
      </div>
    </div>
  );
}

export function MessagesSkeleton() {
  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>
      <ShimmerBlock height="h-14" className="rounded-none" />
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
            <ShimmerBlock height="h-16" className={i % 2 === 0 ? 'w-3/4' : 'w-2/3'} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>
      <div className="flex flex-col items-center pt-10 pb-6 space-y-3">
        <ShimmerBlock height="h-20" className="w-20 rounded-full" />
        <ShimmerBlock height="h-5" className="w-32" />
        <ShimmerBlock height="h-4" className="w-24" />
      </div>
      <div className="px-4 space-y-3">
        <ShimmerBlock height="h-24" />
        <ShimmerBlock height="h-24" />
        <ShimmerBlock height="h-14" />
      </div>
    </div>
  );
}

export function SessionDetailSkeleton() {
  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>
      <ShimmerBlock height="h-14" className="rounded-none" />
      <div className="p-4 space-y-3">
        <ShimmerBlock height="h-8" className="w-64" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => <ShimmerBlock key={i} height="h-20" />)}
        </div>
        <ShimmerBlock height="h-48" />
        <ShimmerBlock height="h-32" />
      </div>
    </div>
  );
}
