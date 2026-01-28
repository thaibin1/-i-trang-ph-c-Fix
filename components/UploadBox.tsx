
import React, { useRef } from 'react';
import { Upload, X, Camera, Image as ImageIcon } from 'lucide-react';
import { ImageAsset } from '../types';

interface UploadBoxProps {
  label: string;
  description: string;
  image: ImageAsset | null;
  onImageSelected: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

export const UploadBox: React.FC<UploadBoxProps> = ({
  label,
  description,
  image,
  onImageSelected,
  onClear,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageSelected(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageSelected(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {label}
        </label>
        {image && !disabled && (
          <button
            onClick={onClear}
            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
          >
            <X size={12} /> Xóa
          </button>
        )}
      </div>

      <div
        className={`
          relative group cursor-pointer transition-all duration-300 ease-in-out
          border-2 border-dashed rounded-xl overflow-hidden h-48 w-full
          flex flex-col items-center justify-center text-center p-3
          ${image 
            ? 'border-secondary/50 bg-secondary/5' 
            : 'border-gray-700 bg-surface hover:border-gray-500 hover:bg-gray-800'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
          disabled={disabled}
        />

        {image ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={image.previewUrl}
              alt={label}
              className="max-w-full max-h-full object-contain rounded-md shadow-lg"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-medium flex items-center gap-2">
                <Upload size={14} /> Thay ảnh
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center group-hover:bg-gray-600 transition-colors">
              <ImageIcon size={20} className="text-gray-300" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-200">Nhấn để tải lên</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{description}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
