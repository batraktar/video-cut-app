export default function HudOverlay({ text }) {
  if (!text) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full text-xl font-mono font-bold shadow-2xl z-[9999] pointer-events-none animate-in fade-in zoom-in duration-100">
      {text}
    </div>
  );
}
