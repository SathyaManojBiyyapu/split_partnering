export default function PageTemplate({
    title,
    subtitle,
    offers,
  }: {
    title: string;
    subtitle: string;
    offers: { title: string; desc: string; deal: string }[];
  }) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 text-white">
        <h1 className="text-3xl font-bold text-[#16FF6E] mb-2">{title}</h1>
        <p className="text-sm text-gray-300 mb-10">{subtitle}</p>
  
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {offers.map((item, i) => (
            <div
              key={i}
              className="border border-[#16FF6E]/40 p-4 rounded-xl bg-black/60 hover:border-[#16FF6E] transition"
            >
              <h2 className="text-lg font-semibold mb-1 text-[#16FF6E]">
                {item.title}
              </h2>
              <p className="text-xs opacity-80 mb-2">{item.desc}</p>
              <p className="text-[#16FF6E] text-xs font-semibold">{item.deal}</p>
            </div>
          ))}
        </div>
  
        <div className="mt-8 text-center">
          <a href="/categories" className="text-[#16FF6E] underline text-sm">
            ← Back to Categories
          </a>
        </div>
      </main>
    );
  }
  