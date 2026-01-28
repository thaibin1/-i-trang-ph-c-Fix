import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Share2, Image as ImageIcon, X, Sparkles, Dices, User, ChevronLeft, ChevronRight, Check, FolderDown } from 'lucide-react';
import { GenerationStatus } from '../types';

interface ResultDisplayProps {
  status: GenerationStatus;
  resultUrl: string | string[] | null; // Supports single URL or Array
  error: string | null;
  onReset: () => void;
  onEditBackground: (prompt: string, index: number) => void;
  onEditPose: (prompt: string, index: number) => void;
}

// Updated to Vietnamese BACKGROUND prompts
const BACKGROUND_PROMPTS = [
  "Đường phố Tokyo nhộn nhịp về đêm với biển hiệu neon, đường ướt phản chiếu ánh sáng điện ảnh.",
  "Bãi biển nhiệt đới đầy nắng, cát trắng, biển xanh ngọc bích, ánh sáng tự nhiên rực rỡ.",
  "Góc ban công quán cà phê Paris ấm cúng vào mùa thu, nắng vàng chiều tà dịu nhẹ.",
  "Thành phố Cyberpunk tương lai với quảng cáo ba chiều, ánh sáng tím và xanh neon.",
  "Phòng triển lãm nghệ thuật tối giản, tường trắng tinh khôi, ánh sáng tản đều mềm mại.",
  "Vườn hoa anh đào nở rộ vào mùa xuân, những cánh hoa hồng rơi lãng mạn.",
  "Sảnh khách sạn sang trọng với sàn đá cẩm thạch và đèn chùm pha lê ấm áp.",
  "Đỉnh núi tuyết hùng vĩ dưới bầu trời xanh trong vắt, ánh sáng ban ngày sắc nét.",
  "Quán bar trên sân thượng sang trọng lúc hoàng hôn, phía sau là đường chân trời thành phố.",
  "Thư viện cổ điển với kệ sách gỗ sồi và ánh sáng vàng ấm áp, tri thức.",
  "Studio nhiếp ảnh thời trang cao cấp, hiện đại với ánh sáng chuyên nghiệp, phông nền mờ ảo.",
  "Khu rừng thần tiên với nấm phát sáng và đom đóm, không khí huyền ảo."
];

// Updated to Vietnamese STANDING poses
const POSE_PROMPTS = [
  "Đứng tự tin, hai tay chống hông, nhìn thẳng vào camera.",
  "Dáng đi catwalk tự tin tiến về phía trước, phong cách thời trang.",
  "Đứng khoanh tay trước ngực, phong thái doanh nhân chuyên nghiệp.",
  "Đứng dựa lưng nhẹ vào tường, thư giãn và tự nhiên.",
  "Đứng góc nghiêng thần thánh, nhìn thẳng về phía trước.",
  "Đứng thoải mái, hai tay đút túi quần, nhìn xa xăm.",
  "Đứng thẳng, một tay vuốt tóc nhẹ nhàng.",
  "Dáng đứng người mẫu, dồn trọng tâm vào một chân.",
  "Đứng quay lưng nhưng ngoái đầu nhìn lại qua vai.",
  "Đứng hơi nghiêng người, hai tay đan nhẹ phía trước."
];

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
  status,
  resultUrl,
  error,
  onReset,
  onEditBackground,
  onEditPose,
}) => {
  const [activeDialog, setActiveDialog] = useState<'none' | 'background' | 'pose'>('none');
  const [promptInput, setPromptInput] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Normalize results to array
  const results = Array.isArray(resultUrl) ? resultUrl : (resultUrl ? [resultUrl] : []);
  const activeImage = results[selectedIndex] || null;

  // Reset index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, results[0]]); // Depend on length or first item change

  const handleOpenDialog = (type: 'background' | 'pose') => {
    setActiveDialog(type);
    setPromptInput(type === 'background' ? getRandomBgPrompt() : getRandomPosePrompt());
  };

  const handleCloseDialog = () => {
    setActiveDialog('none');
  };

  const getRandomBgPrompt = () => BACKGROUND_PROMPTS[Math.floor(Math.random() * BACKGROUND_PROMPTS.length)];
  const getRandomPosePrompt = () => POSE_PROMPTS[Math.floor(Math.random() * POSE_PROMPTS.length)];

  const handleShufflePrompt = () => {
    if (activeDialog === 'background') setPromptInput(getRandomBgPrompt());
    if (activeDialog === 'pose') setPromptInput(getRandomPosePrompt());
  };

  const handleSubmit = () => {
    // Pass the selectedIndex to the handler so we edit the correct image
    if (activeDialog === 'background') onEditBackground(promptInput, selectedIndex);
    if (activeDialog === 'pose') onEditPose(promptInput, selectedIndex);
    handleCloseDialog();
  };

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
        <button
            onClick={() => handleOpenDialog('pose')}
            className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-3 bg-secondary/80 hover:bg-secondary text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
            title="Đổi tư thế cho ảnh đang chọn"
          >
            <User size={18} /> Đổi Tư Thế
        </button>
        <button
            onClick={() => handleOpenDialog('background')}
            className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-3 bg-primary/80 hover:bg-primary text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
            title="Đổi background cho ảnh đang chọn"
          >
            <ImageIcon size={18} /> Đổi Nền
        </button>
        
        {/* Single Download */}
        <a
          href={activeImage || '#'}
          download={`swapnet-result-${selectedIndex + 1}.png`}
          className="flex-none flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          title="Tải ảnh này"
        >
          <Download size={18} />
        </a>

        {/* Download All Button (Only if > 1 result) */}
        {results.length > 1 && (
          <button
            onClick={handleDownloadAll}
            className="flex-none flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            title="Tải tất cả ảnh"
          >
            <FolderDown size={18} />
          </button>
        )}

        <button
          onClick={onReset}
          className="flex-none flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          title="Thử đồ mới"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Shared Dialog for Background or Pose */}
      {activeDialog !== 'none' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={handleCloseDialog} 
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3 mb-4 text-white">
              <div className={`p-2 rounded-lg ${activeDialog === 'background' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-purple-500/20 text-purple-400'}`}>
                {activeDialog === 'background' ? <ImageIcon size={20} /> : <User size={20} />}
              </div>
              <h3 className="text-xl font-bold">
                {activeDialog === 'background' ? 'Đổi Background' : 'Đổi Tư Thế'}
              </h3>
            </div>
            
            <div className="flex justify-between items-center mb-2">
               <p className="text-sm text-gray-400">
                {activeDialog === 'background' ? 'Mô tả background mong muốn (Tiếng Việt):' : 'Mô tả tư thế (Tiếng Việt):'}
              </p>
              <button 
                onClick={handleShufflePrompt}
                className="text-xs flex items-center gap-1 text-secondary hover:text-primary transition-colors"
                title="Gợi ý ngẫu nhiên"
              >
                <Dices size={14} /> Ngẫu nhiên
              </button>
            </div>
            
            <div className="relative mb-6">
              <textarea
                className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-gray-200 placeholder-gray-600 focus:ring-2 focus:ring-primary focus:border-transparent outline-none min-h-[100px] resize-none text-sm leading-relaxed pr-10"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder={activeDialog === 'background' ? "Nhập mô tả background..." : "Ví dụ: Đứng khoanh tay, dựa tường..."}
                autoFocus
              />
              <button 
                onClick={handleShufflePrompt}
                className="absolute right-3 bottom-3 p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                 <Dices size={16} />
              </button>
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={handleCloseDialog} 
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors text-sm font-medium"
              >
                Hủy
              </button>
              <button 
                onClick={handleSubmit} 
                className="px-5 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] transition-all text-sm"
              >
                <Sparkles size={16} /> 
                Tạo mới
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};