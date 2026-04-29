export default function ReviewsLoading() {
  return (
    <div className="flex-1 overflow-y-auto p-7 animate-pulse">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white border border-[#E8E0D4] rounded-xl p-5">
            <div className="h-3 w-20 bg-[#E8E0D4] rounded mb-4"/>
            <div className="h-8 w-16 bg-[#E8E0D4] rounded"/>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="bg-white border border-[#E8E0D4] rounded-xl p-4 h-28"/>
        ))}
      </div>
    </div>
  )
}
