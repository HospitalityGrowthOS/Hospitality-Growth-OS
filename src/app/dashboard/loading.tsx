export default function DashboardLoading() {
  return (
    <div className="flex-1 overflow-y-auto p-7 animate-pulse">
      {/* Topbar skeleton */}
      <div className="h-8 w-48 bg-[#E8E0D4] rounded mb-1"/>
      <div className="h-4 w-64 bg-[#E8E0D4] rounded mb-6"/>

      {/* KPI skeletons */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white border border-[#E8E0D4] border-t-2 border-t-[#E8E0D4] rounded-xl p-5">
            <div className="h-3 w-24 bg-[#E8E0D4] rounded mb-4"/>
            <div className="h-8 w-20 bg-[#E8E0D4] rounded mb-2"/>
            <div className="h-3 w-32 bg-[#E8E0D4] rounded"/>
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-4">
        <div className="bg-white border border-[#E8E0D4] rounded-xl p-5 space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-[#F5F0E8] rounded-lg"/>
          ))}
        </div>
        <div className="bg-white border border-[#E8E0D4] rounded-xl p-5 space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-10 bg-[#F5F0E8] rounded-lg"/>
          ))}
        </div>
      </div>
    </div>
  )
}
