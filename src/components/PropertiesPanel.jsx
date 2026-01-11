import React, { memo } from 'react';
import {
  BoxSelect,
  Circle,
  Clipboard,
  Clock,
  Copy,
  Repeat,
  Square,
  Target,
  Trash2
} from 'lucide-react';
import { SEGMENT_MODES } from '../lib/editorConstants';

function PropertiesPanel({
  isDark,
  activeVideo,
  selectedCount,
  openFfmpegModal,
  openFfmpegBatchModal,
  toggleNotRelevant,
  addCircle,
  clearSegments,
  activeSegments,
  activeSegmentModesMeta,
  activeSegmentMode,
  setActiveSegmentMode,
  segmentDraft,
  setSegmentDraft,
  currentTime,
  parseNumericInput,
  segmentStartRef,
  segmentEndRef,
  addSegmentFromDraft,
  updateSegment,
  moveSegment,
  removeSegment,
  selectedElement,
  duplicateElement,
  copyAttributes,
  pasteAttributes,
  copiedAttributes,
  deleteElement,
  updateElement,
  alignElement,
  snapElementToGrid
}) {
  return (
    <div
      className={`w-full lg:w-80 border-l p-6 overflow-y-auto ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
    >
      <div className="mb-8">
        <button
          onClick={addCircle}
          className={`mt-3 w-full py-3 border rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
        >
          <Circle className="w-4 h-4" /> Додати коло
        </button>
      </div>
      <div className={`mb-8 p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <button
          onClick={openFfmpegModal}
          disabled={!activeVideo}
          className="mt-3 w-full py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white disabled:bg-slate-400"
        >
          Показати команду
        </button>
        <button
          onClick={openFfmpegBatchModal}
          disabled={selectedCount === 0}
          className="mt-2 w-full py-2 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white disabled:bg-slate-400"
        >
          Масовий експорт (обрані)
        </button>
      </div>
      <div className={`mb-8 p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <button
          onClick={() => activeVideo && toggleNotRelevant(activeVideo.id)}
          disabled={!activeVideo}
          className={`mt-3 w-full py-2 rounded-lg text-xs font-bold border ${activeVideo?.notRelevant
            ? 'bg-rose-600 border-rose-500 text-white'
            : isDark
              ? 'bg-slate-900 border-slate-700 text-slate-200'
              : 'bg-white border-slate-300 text-slate-700'
            }`}
        >
          {activeVideo?.notRelevant ? 'Not relevant: ON' : 'Not relevant: OFF'}
        </button>
      </div>
      <div className={`mb-8 p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">Сегменти (експорт)</h3>
          <button
            onClick={clearSegments}
            disabled={activeSegments.length === 0}
            className="text-[10px] text-red-500 disabled:opacity-40"
          >
            Очистити
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeSegmentModesMeta.map(mode => {
            const isActive = activeSegmentMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setActiveSegmentMode(mode.id)}
                className={`px-2 py-1 rounded-full text-[10px] font-bold border ${isActive
                  ? mode.active
                  : isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                  }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full mr-1 ${mode.dot}`} />
                {mode.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] opacity-50">Початок</label>
              <button
                onClick={() => setSegmentDraft(prev => ({ ...prev, start: currentTime }))}
                className={`text-[10px] px-1 rounded flex items-center gap-0.5 ${isDark ? 'text-emerald-300 bg-emerald-900/40 hover:bg-emerald-900' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                title="Встановити поточний (M)"
              >
                <Target className="w-3 h-3" /> M
              </button>
            </div>
            <input
              type="number"
              step="0.1"
              value={Number.isFinite(segmentDraft.start) ? segmentDraft.start.toFixed(3) : ''}
              onChange={e =>
                setSegmentDraft(prev => ({
                  ...prev,
                  start: e.target.value === '' ? null : parseNumericInput(e.target.value)
                }))
              }
              data-segment-input="true"
              ref={segmentStartRef}
              className={`w-full text-xs p-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                }`}
              placeholder="0.0"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] opacity-50">Кінець</label>
              <button
                onClick={() => setSegmentDraft(prev => ({ ...prev, end: currentTime }))}
                className={`text-[10px] px-1 rounded flex items-center gap-0.5 ${isDark ? 'text-emerald-300 bg-emerald-900/40 hover:bg-emerald-900' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                title="Встановити поточний (/)"
              >
                <Target className="w-3 h-3" /> /
              </button>
            </div>
            <input
              type="number"
              step="0.1"
              value={Number.isFinite(segmentDraft.end) ? segmentDraft.end.toFixed(3) : ''}
              onChange={e =>
                setSegmentDraft(prev => ({
                  ...prev,
                  end: e.target.value === '' ? null : parseNumericInput(e.target.value)
                }))
              }
              data-segment-input="true"
              ref={segmentEndRef}
              className={`w-full text-xs p-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                }`}
              placeholder="0.0"
            />
          </div>
        </div>
        <button
          onClick={addSegmentFromDraft}
          className="w-full py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          Додати сегмент
        </button>
        <div className="space-y-2">
          {activeSegments.length === 0 && (
            <div className="text-[10px] text-slate-400">Немає сегментів для експорту</div>
          )}
          {activeSegments.map((seg, idx) => (
            <div key={seg.id} className="flex items-center gap-2 text-[10px]">
              <div className="text-slate-400 w-5 text-right">{idx + 1}</div>
              <input
                type="number"
                step="0.1"
                value={seg.start.toFixed(3)}
                onChange={e => {
                  const next = parseNumericInput(e.target.value);
                  if (!Number.isFinite(next)) return;
                  updateSegment(seg.id, { start: next });
                }}
                className={`w-16 p-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                  }`}
              />
              <span className="text-slate-400">-</span>
              <input
                step="0.1"
                value={seg.end.toFixed(3)}
                onChange={e => {
                  const next = parseNumericInput(e.target.value);
                  if (!Number.isFinite(next)) return;
                  updateSegment(seg.id, { end: next });
                }}
                className={`w-16 p-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                  }`}
              />
              <button
                onClick={() => moveSegment(seg.id, -1)}
                className="px-1 text-slate-400 hover:text-slate-700"
                title="Вгору"
              >
                Up
              </button>
              <button
                onClick={() => moveSegment(seg.id, 1)}
                className="px-1 text-slate-400 hover:text-slate-700"
                title="Вниз"
              >
                Down
              </button>
              <button
                onClick={() => removeSegment(seg.id)}
                className="px-1 text-red-500"
                title="Видалити"
              >
                X
              </button>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-slate-400">
          Під час експорту використовуються сегменти. Якщо сегментів немає — застосовується Trim.
        </div>
      </div>
      {selectedElement ? (
        <div className={`p-4 rounded-xl border space-y-4 animate-in fade-in ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <h3 className="font-bold text-sm">Налаштування</h3>
            <div className="flex gap-1">
              <button
                onClick={() => duplicateElement(selectedElement.id)}
                className={`p-1.5 rounded transition ${isDark ? 'hover:bg-indigo-900 text-indigo-400' : 'hover:bg-indigo-100 text-indigo-600'}`}
                title="Дублювати"
              >
                <Repeat className="w-4 h-4" />
              </button>
              <button
                onClick={() => copyAttributes(selectedElement)}
                className={`p-1.5 rounded transition ${isDark ? 'hover:bg-indigo-900 text-indigo-400' : 'hover:bg-indigo-100 text-indigo-600'}`}
                title="Копіювати налаштування"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => pasteAttributes(selectedElement.id)}
                disabled={!copiedAttributes}
                className={`p-1.5 rounded transition disabled:opacity-30 disabled:hover:bg-transparent ${isDark ? 'hover:bg-indigo-900 text-indigo-400' : 'hover:bg-indigo-100 text-indigo-600'
                  }`}
                title="Вставити налаштування"
              >
                <Clipboard className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteElement(selectedElement.id)}
                className="p-1.5 rounded transition hover:bg-red-100 text-red-500"
                title="Видалити"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold opacity-70">
              <Clock className="w-3 h-3" /> Час появи (M /)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] opacity-50">З</label>
                  <button
                    onClick={() => updateElement(selectedElement.id, { startTime: currentTime })}
                    className={`text-[10px] px-1 rounded flex items-center gap-0.5 ${isDark ? 'text-indigo-300 bg-indigo-900/50 hover:bg-indigo-900' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                      }`}
                    title="Встановити поточний (M)"
                  >
                    <Target className="w-3 h-3" /> M
                  </button>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={selectedElement.startTime.toFixed(3)}
                  onChange={e => updateElement(selectedElement.id, { startTime: Number(e.target.value) })}
                  className={`w-full text-xs p-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                    }`}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] opacity-50">До</label>
                  <button
                    onClick={() => updateElement(selectedElement.id, { endTime: currentTime })}
                    className={`text-[10px] px-1 rounded flex items-center gap-0.5 ${isDark ? 'text-indigo-300 bg-indigo-900/50 hover:bg-indigo-900' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                      }`}
                    title="Встановити поточний (/)"
                  >
                    <Target className="w-3 h-3" /> /
                  </button>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={selectedElement.endTime.toFixed(3)}
                  onChange={e => updateElement(selectedElement.id, { endTime: Number(e.target.value) })}
                  className={`w-full text-xs p-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                    }`}
                />
              </div>
            </div>
          </div>
          <div className={`space-y-2 pt-2 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <label className="text-xs font-bold opacity-70 block">Стиль</label>
            <div className="flex gap-2">
              <button
                onClick={() => updateElement(selectedElement.id, { isOutline: true, color: '#ffffff', thickness: 1 })}
                className={`flex-1 py-2 rounded border transition flex items-center justify-center gap-2 ${selectedElement.isOutline
                  ? isDark
                    ? 'bg-slate-700 border-slate-500'
                    : 'bg-slate-800 text-white'
                  : isDark
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-slate-300'
                  }`}
                title="Контур"
              >
                <BoxSelect className="w-4 h-4" /> <span className="text-[10px]">Контур</span>
              </button>
              <button
                onClick={() => updateElement(selectedElement.id, { isOutline: false, color: '#000000' })}
                className={`flex-1 py-2 rounded border transition flex items-center justify-center gap-2 ${!selectedElement.isOutline
                  ? isDark
                    ? 'bg-slate-700 border-slate-500'
                    : 'bg-slate-800 text-white'
                  : isDark
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-slate-300'
                  }`}
                title="Заливка"
              >
                <Square className="w-4 h-4 fill-current" /> <span className="text-[10px]">Заливка</span>
              </button>
            </div>
            <div className="flex gap-2 items-center justify-center pt-2">
              <button
                onClick={() => updateElement(selectedElement.id, { color: '#000000', isOutline: false })}
                className="w-8 h-8 bg-black rounded border border-slate-500 hover:scale-110 transition shadow-sm"
                title="Чорний"
              ></button>
              <button
                onClick={() => updateElement(selectedElement.id, { color: '#ffffff' })}
                className="w-8 h-8 bg-white rounded border border-slate-300 hover:scale-110 transition shadow-sm"
                title="Білий"
              ></button>
              <input
                type="color"
                value={selectedElement.color}
                onChange={e => updateElement(selectedElement.id, { color: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
              />
            </div>
          </div>
          {selectedElement.isOutline && (
            <div className="space-y-1">
              <label className="text-[10px] opacity-50">Товщина</label>
              <div className="text-[10px] text-slate-400">1px (фіксована)</div>
            </div>
          )}
          <div className="space-y-2 pt-2 border-t">
            <label className="text-xs font-bold opacity-70 block">Канал</label>
            <select
              value={selectedElement.channelMode || 'all'}
              onChange={e => updateElement(selectedElement.id, { channelMode: e.target.value })}
              className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'}`}
            >
              <option value="all">Всі</option>
              {SEGMENT_MODES.map(mode => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 pt-2 border-t">
            <label className="text-xs font-bold opacity-70 block">Вирівнювання</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => alignElement(selectedElement.id, 'left')}
                className="text-[10px] py-1 rounded border bg-slate-100 hover:bg-slate-200"
              >
                Вліво
              </button>
              <button
                onClick={() => alignElement(selectedElement.id, 'center-h')}
                className="text-[10px] py-1 rounded border bg-slate-100 hover:bg-slate-200"
              >
                Центр
              </button>
              <button
                onClick={() => alignElement(selectedElement.id, 'right')}
                className="text-[10px] py-1 rounded border bg-slate-100 hover:bg-slate-200"
              >
                Вправо
              </button>
              <button
                onClick={() => alignElement(selectedElement.id, 'top')}
                className="text-[10px] py-1 rounded border bg-slate-100 hover:bg-slate-200"
              >
                Вгору
              </button>
              <button
                onClick={() => alignElement(selectedElement.id, 'center-v')}
                className="text-[10px] py-1 rounded border bg-slate-100 hover:bg-slate-200"
              >
                Центр V
              </button>
              <button
                onClick={() => alignElement(selectedElement.id, 'bottom')}
                className="text-[10px] py-1 rounded border bg-slate-100 hover:bg-slate-200"
              >
                Вниз
              </button>
            </div>
            <button
              onClick={() => snapElementToGrid(selectedElement.id)}
              className="w-full text-[10px] py-2 rounded border bg-slate-200 hover:bg-slate-300"
              title="Прив’язка до сітки 5%"
            >
              Snap 5%
            </button>
          </div>
        </div>
      ) : (
        <div className={`p-8 text-center text-xs border border-dashed rounded-xl ${isDark ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
          Натисніть на фігуру на відео або таймлайні, щоб редагувати її
        </div>
      )}
    </div>
  );
}

export default memo(PropertiesPanel);
