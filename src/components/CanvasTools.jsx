import {
  Circle,
  Hand,
  MousePointer2,
  Scan,
  Square,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

const ToolButton = ({ active = false, label, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    aria-pressed={active}
    className={`relative flex h-10 w-10 items-center justify-center rounded-md border transition ${
      active
        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
        : 'border-transparent text-slate-300 hover:border-slate-600 hover:bg-slate-700/80 hover:text-white'
    }`}
  >
    {children}
    {active && <span className="absolute -left-1 h-5 w-0.5 rounded bg-cyan-400" />}
  </button>
);

export default function CanvasTools({
  tool,
  zoom,
  onToolChange,
  onFit,
  onZoomIn,
  onZoomOut,
  onAddRect,
  onAddCircle
}) {
  return (
    <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-slate-700 bg-slate-800 px-1.5 py-2">
      <ToolButton
        active={tool === 'select'}
        label="Вибір і редагування"
        onClick={() => onToolChange('select')}
      >
        <MousePointer2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        active={tool === 'pan'}
        label="Переміщення полотна (або утримуйте пробіл)"
        onClick={() => onToolChange('pan')}
      >
        <Hand className="h-4 w-4" />
      </ToolButton>

      <div className="my-1 h-px w-8 bg-slate-700" />

      <ToolButton label="Вписати відео в робочу область" onClick={onFit}>
        <Scan className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Збільшити" onClick={onZoomIn}>
        <ZoomIn className="h-4 w-4" />
      </ToolButton>
      <div className="w-full py-0.5 text-center font-mono text-[9px] text-slate-400">
        {Math.round(zoom * 100)}%
      </div>
      <ToolButton label="Зменшити" onClick={onZoomOut}>
        <ZoomOut className="h-4 w-4" />
      </ToolButton>

      <div className="my-1 h-px w-8 bg-slate-700" />

      <ToolButton
        label="Додати прямокутник"
        onClick={() => {
          onAddRect();
          onToolChange('select');
        }}
      >
        <Square className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Додати коло"
        onClick={() => {
          onAddCircle();
          onToolChange('select');
        }}
      >
        <Circle className="h-4 w-4" />
      </ToolButton>

      <div className="mt-auto pb-1 text-center text-[9px] leading-tight text-slate-500">
        wheel
        <br />
        zoom
      </div>
    </aside>
  );
}
