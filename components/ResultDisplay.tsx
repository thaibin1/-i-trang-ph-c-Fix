
import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Image as ImageIcon, Check, FolderDown } from 'lucide-react';
import { GenerationStatus } from '../types';

interface ResultDisplayProps {
  status: GenerationStatus;
  resultUrl: string | string[] | null; // Supports single URL or Array
  error: string | null;
  onReset: () => void;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
  status,
  resultUrl,
  error,
  onReset,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Normalize results to array
  const results = Array.isArray(resultUrl) ? resultUrl : (resultUrl ? [resultUrl] : []);
  const activeImage = results[selectedIndex] || null;

  // Reset index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, results[0]]);

  const handleDownloadAll = async () => {
    // Sequential download trigger
    for (let i = 0; i < results.length; i++) {
      const link = document.createElement('a');
      link.href = results[i];
      link.download = `swapnet-result-${i + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Delay to ensure browser processes each download
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  if (status === GenerationStatus.IDLE) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-gray-500 bg-surface rounded-xl border border-gray-800 p-8 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-gray-800 flex items-center justify-center">
          <RefreshCw size={32} className="opacity-20" />
        </div>
        <h3 className="text-xl font-semibold text-gray-400 mb-2">Sẵn sàng hiển thị</h3>
        <p className="max-w-xs mx-auto text-sm">
          Tải lên ảnh người mẫu và trang phục để xem điều kỳ diệu.
        </p>
      </div>
    );
  }

  if (status === GenerationStatus.PROCESSING || status === GenerationStatus.UPLOADING) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-surface rounded-xl border border-gray-800 p-8 text-center relative overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 animate-pulse-fast"></div>
        
        <div className="relative z-10">
          <div className="w-16 h-16 mb-6 rounded-full border-4 border-t-primary border-r-secondary border-b-transparent border-l-transparent animate-spin mx-auto"></div>
          <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary mb-2 animate-pulse">
            Đang xử lý hình ảnh...
          </h3>
          <p className="text-gray-400 text-sm max-w-xs mx-auto">
            Gemini 3 Pro đang làm việc.
            <br/>Quá trình có thể mất thời gian nếu tạo nhiều ảnh.
          </p>
        </div>
      </div>
    );
  }

  if (status === GenerationStatus.FAILED) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-surface rounded-xl border border-red-900/30 p-8 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-red-900/20 flex items-center justify-center text-red-400">
          <span className="text-3xl">!</span>
        </div>
        <h3 className="text-xl font-semibold text-red-200 mb-2">Xử lý thất bại</h3>
        <p className="text-red-300/70 text-sm max-w-md mx-auto mb-6">
          {error || "Đã có lỗi xảy ra. Vui lòng thử lại."}
        </p>
        <button
          onClick={onReset}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Main Image Display */}
      <div className="relative group bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800 flex-grow flex items-center justify-center min-h-[400px]">
        {activeImage && (
          <img
            src={activeImage}
            alt="Kết quả thử đồ ảo"
            className="max-w-full max-h-[70vh] object-contain animate-in fade-in duration-500"
          />
        )}
        
        {/* Pagination Counter if multiple */}
        {results.length > 1 && (
            <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-white text-xs font-medium border border-white/10">
                {selectedIndex + 1} / {results.length}
            </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-end">
          <span className="text-white text-sm font-medium">Được tạo bởi Gemini 3 Pro</span>
        </div>
      </div>

      {/* Thumbnails (Only if > 1 result) */}
      {results.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide">
              {results.map((img, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setSelectedIndex(idx)}
                    className={`relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${selectedIndex === idx ? 'border-primary shadow-lg shadow-primary/20 scale-105' : 'border-gray-800 opacity-60 hover:opacity-100'}`}
                  >
                      <img src={img} className="w-full h-full object-cover" alt={`Variant ${idx+1}`} />
                      {selectedIndex === idx && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <div className="bg-primary rounded-full p-0.5">
                                  <Check size={12} className="text-white" />
                              </div>
                          </div>
                      )}
                  </button>
              ))}
          </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 w-full">
        {/* Single Download */}
        <a
          href={activeImage || '#'}
          download={`swapnet-result-${selectedIndex + 1}.png`}
          className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 bg-primary/80 hover:bg-primary text-white rounded-lg font-medium transition-colors"
          title="Tải ảnh này"
        >
          <Download size={18} /> Tải Ảnh
        </a>

        {/* Download All Button (Only if > 1 result) */}
        {results.length > 1 && (
          <button
            onClick={handleDownloadAll}
            className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            title="Tải tất cả ảnh"
          >
            <FolderDown size={18} /> Tải Tất Cả
          </button>
        )}

        <button
          onClick={onReset}
          className="flex-none flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          title="Thử đồ mới"
        >
          <RefreshCw size={18} /> <span className="hidden sm:inline">Thử Lại</span>
        </button>
      </div>
    </div>
  );
};
