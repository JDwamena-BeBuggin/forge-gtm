export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f3ee]">
      <div className="text-center">
        <h1 className="text-6xl font-serif font-light text-[#1a1814] mb-4">404</h1>
        <p className="text-[#6b6560]">Page not found</p>
        <a href="/" className="mt-6 inline-block text-sm text-[#c2410c] hover:underline">← Back to dashboard</a>
      </div>
    </div>
  )
}
