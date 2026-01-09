import { Upload, Video } from 'lucide-react';

export default function EmptyState({ onFileChange }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
      <Video className="w-16 h-16 opacity-10 mb-4" />
      <p>Оберіть або додайте відео</p>
      <label className="mt-4 flex items-center gap-2 cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
        <Upload className="w-4 h-4" /> Завантажити
        <input type="file" accept="video/*" multiple onChange={onFileChange} className="hidden" />
      </label>
    </div>
  );
}
