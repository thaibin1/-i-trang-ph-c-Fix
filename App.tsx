
// Fix: Correct variable name typos and remove manual API key input UI.
import React, { useState, useEffect } from 'react';
import { UploadBox } from './components/UploadBox';
import { ResultDisplay } from './components/ResultDisplay';
import { generateVirtualTryOn, changeImageBackground, analyzeOutfit, generatePromptsFromAnalysis } from './services/geminiService';
import { ImageAsset, GenerationStatus } from './types';
import { Sparkles, Shirt, User, LogOut, Lock, Image as ImageIcon, Copy, Loader2, Video, Bookmark, Library, Hash, Key, ExternalLink, X, Cpu } from 'lucide-react';

// --- Constants ---
const STORAGE_KEY_MODELS = 'swapnet_saved_models';

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState(false);
  
  const [modelName, setModelName] = useState<string>('gemini-3-pro-image-preview');
  const [activeTab, setActiveTab] = useState<'try-on' | 'background' | 'veo-prompt'>('try-on');

  // --- MODEL LIBRARY STATE ---
  const [savedModels, setSavedModels] = useState<ImageAsset[]>([]);

  // --- TRY-ON STATE (Defaults applied as requested) ---
  const [personImage, setPersonImage] = useState<ImageAsset | null>(null);
  const [garmentImage, setGarmentImage] = useState<ImageAsset | null>(null);
  const [garmentDetailImage, setGarmentDetailImage] = useState<ImageAsset | null>(null);
  const [accessoryImage, setAccessoryImage] = useState<ImageAsset | null>(null);
  const [instructions, setInstructions] = useState('');
  const tryOnAspectRatio = "9:16";
  const tryOnImageSize = "4K";
  const tryOnCount = 1;
  
  const [tryOnStatus, setTryOnStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [tryOnResult, setTryOnResult] = useState<string | string[] | null>(null);
  const [tryOnError, setTryOnError] = useState<string | null>(null);

  // --- BACKGROUND CHANGE STATE (Defaults applied as requested) ---
  const [bgInputImage, setBgInputImage] = useState<ImageAsset | null>(null);
  const [bgDetailImage, setBgDetailImage] = useState<ImageAsset | null>(null);
  const [customBgImage, setCustomBgImage] = useState<ImageAsset | null>(null);
  const [bgPrompt, setBgPrompt] = useState('');
  const bgAspectRatio = "9:16";
  const bgImageSize = "4K";
  const [bgStatus, setBgStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [bgResult, setBgResult] = useState<string | string[] | null>(null);
  const [bgError, setBgError] = useState<string | null>(null);

  // --- VEO PROMPT STATE ---
  const [veoImage, setVeoImage] = useState<ImageAsset | null>(null);
  const [veoDetailImage, setVeoDetailImage] = useState<ImageAsset | null>(null);
  const [veoPromptCount, setVeoPromptCount] = useState<number>(3);
  const [veoAnalysis, setVeoAnalysis] = useState<string | null>(null);
  const [veoPrompts, setVeoPrompts] = useState<string[]>([]);
  const [veoStatus, setVeoStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [veoError, setVeoError] = useState<string | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio) {
        try {
          const selected = await (window as any).aistudio.hasSelectedApiKey();
          if (selected) setHasKey(true);
        } catch (e) {
          console.error("Error checking API key status", e);
        }
      }
    };
    checkKey();
    
    const stored = localStorage.getItem(STORAGE_KEY_MODELS);
    if (stored) {
      try {
        setSavedModels(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse saved models", e);
      }
    }
  }, []);

  const handleConnectKey = async () => {
    if ((window as any).aistudio) {
      try {
        await (window as any).aistudio.openSelectKey();
        setHasKey(true);
      } catch (e) {
        console.error("Failed to select key", e);
      }
    }
  };

  const handleLogout = () => {
    setHasKey(false);
    resetAll();
  };

  const resetAll = () => {
    setPersonImage(null);
    setGarmentImage(null);
    setGarmentDetailImage(null);
    setAccessoryImage(null);
    setInstructions('');
    setTryOnStatus(GenerationStatus.IDLE);
    setTryOnResult(null);
    setTryOnError(null);
    setBgStatus(GenerationStatus.IDLE);
    setBgResult(null);
    setBgError(null);
    setVeoStatus(GenerationStatus.IDLE);
    setVeoPrompts([]);
    setVeoAnalysis(null);
  };

  const processFile = (file: File): Promise<ImageAsset> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && typeof e.target.result === 'string') {
          resolve({
            id: crypto.randomUUID(),
            data: e.target.result,
            mimeType: file.type,
            previewUrl: e.target.result,
          });
        } else {
          reject(new Error("Không thể đọc tệp"));
        }
      };
      reader.onerror = () => reject(new Error("Đọc tệp thất bại"));
      reader.readAsDataURL(file);
    });
  };

  const saveCurrentModel = () => {
    if (!personImage) return;
    const exists = savedModels.some(m => m.data.substring(0, 100) === personImage.data.substring(0, 100));
    if (exists) {
        alert("Người mẫu này đã có trong thư viện!");
        return;
    }
    const newModels = [personImage, ...savedModels];
    setSavedModels(newModels);
    localStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(newModels));
  };

  const deleteSavedModel = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newModels = savedModels.filter(m => m.id !== id);
    setSavedModels(newModels);
    localStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(newModels));
  };

  const selectSavedModel = (model: ImageAsset) => {
    setPersonImage(model);
    if (tryOnStatus === GenerationStatus.COMPLETED) {
      setTryOnStatus(GenerationStatus.IDLE);
      setTryOnResult(null);
    }
  };

  const handleGenerateTryOn = async () => {
    if (!personImage || (!garmentImage && !accessoryImage)) return;
    setTryOnStatus(GenerationStatus.PROCESSING);
    setTryOnError(null);
    try {
      const results = await generateVirtualTryOn(
        personImage, 
        garmentImage, 
        garmentDetailImage, 
        accessoryImage, 
        instructions, 
        tryOnAspectRatio, 
        tryOnImageSize, 
        modelName,
        tryOnCount
      );
      setTryOnResult(results);
      setTryOnStatus(GenerationStatus.COMPLETED);
    } catch (err: any) {
      // Fix: If Requested entity was not found, reset hasKey to force re-selection.
      if (err.message && (err.message.includes('Requested entity was not found') || err.message.includes('404'))) {
        setHasKey(false);
      }
      setTryOnStatus(GenerationStatus.FAILED);
      setTryOnError(err.message || "Xử lý thất bại");
    }
  };

  const handleGenerateBackground = async () => {
    if (!bgInputImage) return;
    setBgStatus(GenerationStatus.PROCESSING);
    setBgError(null);
    try {
      const result = await changeImageBackground(bgInputImage.data, bgPrompt.trim() || "Clean studio background", bgDetailImage, bgAspectRatio, bgImageSize, modelName, customBgImage);
      setBgResult(result);
      setBgStatus(GenerationStatus.COMPLETED);
    } catch (err: any) {
      // Fix: If Requested entity was not found, reset hasKey to force re-selection.
      if (err.message && (err.message.includes('Requested entity was not found') || err.message.includes('404'))) {
        setHasKey(false);
      }
      setBgStatus(GenerationStatus.FAILED);
      setBgError(err.message || "Đổi nền thất bại");
    }
  };

  const handleGenerateVeoPrompt = async () => {
    if (!veoImage) return;
    setVeoStatus(GenerationStatus.PROCESSING);
    setVeoError(null);
    try {
      let analysisText = veoAnalysis || await analyzeOutfit(veoImage, veoDetailImage);
      setVeoAnalysis(analysisText);
      const prompts = await generatePromptsFromAnalysis(analysisText, veoPromptCount);
      setVeoPrompts(prompts);
      setVeoStatus(GenerationStatus.COMPLETED);
    } catch (err: any) {
      // Fix: If Requested entity was not found, reset hasKey to force re-selection.
      if (err.message && (err.message.includes('Requested entity was not found') || err.message.includes('404'))) {
        setHasKey(false);
      }
      setVeoStatus(GenerationStatus.FAILED);
      setVeoError(err.message || "Tạo prompt thất bại");
    }
  };

  const isPermissionError = (error: string | null) => {
    if (!error) return false;
    return error.includes('403') || error.includes('Permission Denied') || error.includes('404');
  };

  if (!hasKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-dark text-slate-100 p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_70%)]"></div>
        <div className="bg-surface p-8 md:p-12 rounded-2xl border border-gray-800 shadow-2xl max-w-lg w-full text-center relative z-10">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-2xl mx-auto flex items-center justify-center mb-8 shadow-lg shadow-primary/20">
            <Sparkles size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Đổi trang phục AI by Thai Bin</h1>
          <p className="text-gray-400 mb-6">Sử dụng Gemini 3 Pro để tạo hình ảnh chất lượng cao 4K.</p>
          <button onClick={handleConnectKey} className="w-full py-4 px-6 bg-white text-dark hover:bg-gray-200 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-colors mb-6 shadow-xl">
            <Key size={24} /> Chọn Key qua AI Studio
          </button>
          <p className="mt-8 text-xs text-gray-500 leading-relaxed">
            Lưu ý: Gemini 3 Pro yêu cầu API Key từ project Google Cloud có cấu hình thanh toán (Paid Project). 
            <br/>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-primary hover:underline mt-2 inline-flex items-center gap-1">Xem tài liệu billing <ExternalLink size={10} /></a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-dark text-slate-100">
      <header className="border-b border-gray-800 bg-dark/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Shirt className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">AI Creative Studio <span className="text-xs align-top bg-primary/20 text-primary px-1.5 py-0.5 rounded ml-1">by Thai Bin</span></h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="hidden md:flex items-center bg-gray-900 rounded-lg border border-gray-700 px-3 py-1">
               <Cpu size={14} className="text-primary mr-2" />
               <span className="text-xs font-bold text-gray-300">Gemini 3.0 Pro 4K</span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1 hover:text-red-400 transition-colors py-1 px-3 rounded-lg hover:bg-white/5">
              <LogOut size={16} /> <span className="hidden sm:inline">Đổi Key</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-8">
        <div className="flex justify-center mb-8 overflow-x-auto">
          <div className="bg-surface/50 p-1 rounded-xl border border-gray-800 flex gap-1 whitespace-nowrap">
            <button onClick={() => setActiveTab('try-on')} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === 'try-on' ? 'bg-gradient-to-r from-primary/20 to-secondary/20 text-white border border-primary/30' : 'text-gray-400 hover:text-white'}`}>
              <Shirt size={18} /> Thử Đồ AI
            </button>
            <button onClick={() => setActiveTab('background')} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === 'background' ? 'bg-gradient-to-r from-primary/20 to-secondary/20 text-white border border-primary/30' : 'text-gray-400 hover:text-white'}`}>
              <ImageIcon size={18} /> Đổi Background
            </button>
            <button onClick={() => setActiveTab('veo-prompt')} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === 'veo-prompt' ? 'bg-gradient-to-r from-primary/20 to-secondary/20 text-white border border-primary/30' : 'text-gray-400 hover:text-white'}`}>
              <Video size={18} /> Prompt Video
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 flex flex-col gap-6">
             {activeTab === 'try-on' && (
                <>
                <div className="bg-surface/50 p-6 rounded-2xl border border-gray-800 shadow-xl relative">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-primary">
                        <User size={20} />
                        <h3 className="text-lg font-semibold">1. Chọn người mẫu</h3>
                    </div>
                    {personImage && (
                        <button onClick={saveCurrentModel} className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/20 transition-all">
                            <Bookmark size={14} /> Lưu mẫu này
                        </button>
                    )}
                  </div>
                  <UploadBox label="Người mẫu" description="Tải ảnh người mẫu gốc của bạn" image={personImage} onImageSelected={(f) => processFile(f).then(setPersonImage)} onClear={() => setPersonImage(null)} disabled={tryOnStatus === GenerationStatus.PROCESSING} />

                  {savedModels.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-800">
                          <div className="flex items-center gap-2 mb-4 text-gray-400">
                              <Library size={16} />
                              <span className="text-xs font-bold uppercase tracking-widest">Thư viện mẫu</span>
                          </div>
                          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                              {savedModels.map((model) => (
                                  <div key={model.id} onClick={() => selectSavedModel(model)} className={`group relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${personImage?.id === model.id ? 'border-primary' : 'border-gray-800 hover:border-gray-600'}`}>
                                      <img src={model.previewUrl} className="w-full h-full object-cover" />
                                      <button onClick={(e) => deleteSavedModel(model.id, e)} className="absolute top-0 right-0 p-1 bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"><X size={10} /></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
                </div>

                <div className="bg-surface/50 p-6 rounded-2xl border border-gray-800 shadow-xl">
                  <div className="flex items-center gap-2 mb-6 text-secondary"><Shirt size={20} /><h3 className="text-lg font-semibold">2. Chọn trang phục</h3></div>
                  <UploadBox label="Trang phục" description="Tải lên bộ đồ bạn muốn thay cho mẫu" image={garmentImage} onImageSelected={(f) => processFile(f).then(setGarmentImage)} onClear={() => setGarmentImage(null)} disabled={tryOnStatus === GenerationStatus.PROCESSING} />
                </div>

                <button onClick={handleGenerateTryOn} disabled={!personImage || (!garmentImage && !accessoryImage) || tryOnStatus === GenerationStatus.PROCESSING} className="w-full py-4 px-6 rounded-xl font-bold text-lg bg-gradient-to-r from-primary to-secondary text-white shadow-lg flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01]">
                  <Sparkles size={20} className={tryOnStatus === GenerationStatus.PROCESSING ? 'animate-spin' : ''} /> {tryOnStatus === GenerationStatus.PROCESSING ? `Đang tạo ảnh 4K (9:16)...` : 'Bắt đầu hoán đổi'}
                </button>
                </>
             )}

             {activeTab === 'background' && (
                <div className="space-y-6">
                  <div className="bg-surface/50 p-6 rounded-2xl border border-gray-800 shadow-xl">
                    <UploadBox label="Ảnh gốc" description="Tải ảnh cần đổi nền" image={bgInputImage} onImageSelected={(f) => processFile(f).then(setBgInputImage)} onClear={() => setBgInputImage(null)} />
                  </div>
                  <div className="bg-surface/50 p-6 rounded-2xl border border-gray-800 shadow-xl">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-3">Mô tả bối cảnh mới</label>
                    <textarea value={bgPrompt} onChange={(e) => setBgPrompt(e.target.value)} placeholder="VD: Studio hiện đại, bãi biển lúc hoàng hôn, đường phố London..." className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-sm h-32 outline-none focus:ring-1 focus:ring-secondary resize-none" />
                    <p className="text-[10px] text-gray-500 mt-2">Mặc định: 1 ảnh, tỉ lệ 9:16, chất lượng 4K.</p>
                  </div>
                  <button onClick={handleGenerateBackground} disabled={!bgInputImage || bgStatus === GenerationStatus.PROCESSING} className="w-full py-4 bg-secondary text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                    {bgStatus === GenerationStatus.PROCESSING ? <Loader2 className="animate-spin" size={20} /> : <ImageIcon size={20} />}
                    {bgStatus === GenerationStatus.PROCESSING ? 'Đang xử lý 4K...' : 'Đổi Background'}
                  </button>
                </div>
             )}

             {activeTab === 'veo-prompt' && (
                <div className="space-y-6">
                  <div className="bg-surface/50 p-6 rounded-2xl border border-gray-800 shadow-xl">
                    <UploadBox label="Ảnh mẫu" description="Tải ảnh để phân tích prompt" image={veoImage} onImageSelected={(f) => processFile(f).then(setVeoImage)} onClear={() => setVeoImage(null)} />
                  </div>
                  <div className="bg-surface/50 p-6 rounded-2xl border border-gray-800 shadow-xl">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-4">Số lượng Prompt cần tạo</label>
                    <div className="flex gap-3">
                      {[3, 5, 8, 10].map((n) => (
                        <button key={n} onClick={() => setVeoPromptCount(n)} className={`flex-1 py-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${veoPromptCount === n ? 'bg-primary/20 border-primary text-white' : 'bg-dark border-gray-700 text-gray-500'}`}>
                           <Hash size={14} />
                           <span className="text-xs font-bold">{n}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleGenerateVeoPrompt} disabled={!veoImage || veoStatus === GenerationStatus.PROCESSING} className="w-full py-4 bg-white text-black rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                    {veoStatus === GenerationStatus.PROCESSING ? <Loader2 size={20} className="animate-spin" /> : <Video size={20} />}
                    Viết Prompt Video
                  </button>
                </div>
             )}
          </div>

          <div className="lg:col-span-7">
             <div className="bg-surface/30 p-2 rounded-2xl border border-gray-800 shadow-2xl min-h-[500px]">
                {/* Fix: Specifically use correct error state names here. */}
                {(isPermissionError(tryOnError) || isPermissionError(bgError) || isPermissionError(veoError)) && (
                   <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
                      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 mb-2">
                        <Lock size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white">Lỗi Quyền Truy Cập (403/404)</h3>
                      <p className="text-gray-400 max-w-md text-sm leading-relaxed">
                        Model Gemini 3.0 Pro yêu cầu một API Key từ dự án Google Cloud có cấu hình thanh toán (Paid Project). Key hiện tại không có quyền truy cập hoặc không tìm thấy model.
                      </p>
                      <div className="flex gap-3 pt-4">
                        <button onClick={handleLogout} className="px-6 py-2 bg-primary text-white rounded-lg font-bold flex items-center gap-2 hover:bg-primary/80 transition-all">
                           <Key size={16} /> Chọn Lại Key
                        </button>
                        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="px-6 py-2 bg-gray-800 text-gray-300 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-700 transition-all">
                           <ExternalLink size={16} /> Tìm hiểu thêm
                        </a>
                      </div>
                   </div>
                )}

                {!isPermissionError(tryOnError) && !isPermissionError(bgError) && !isPermissionError(veoError) && (
                   <ResultDisplay 
                     status={activeTab === 'try-on' ? tryOnStatus : (activeTab === 'background' ? bgStatus : veoStatus)} 
                     resultUrl={activeTab === 'try-on' ? tryOnResult : (activeTab === 'background' ? bgResult : null)} 
                     error={activeTab === 'try-on' ? tryOnError : (activeTab === 'background' ? bgError : veoError)}
                     onReset={() => resetAll()}
                   />
                )}
                
                {activeTab === 'veo-prompt' && veoPrompts.length > 0 && (
                   <div className="p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <h4 className="font-bold flex items-center gap-2 text-primary uppercase text-xs tracking-widest"><Video size={14} /> Danh sách Prompt Video</h4>
                      {veoPrompts.map((p, i) => (
                         <div key={i} className="bg-dark p-4 rounded-lg border border-gray-700 text-sm flex justify-between items-start gap-4 hover:border-blue-500/50 transition-colors group">
                            <span className="italic text-gray-300">"{p}"</span>
                            <button onClick={() => { navigator.clipboard.writeText(p); alert("Đã chép prompt vào bộ nhớ tạm!"); }} className="text-gray-500 group-hover:text-primary transition-colors p-1"><Copy size={16} /></button>
                         </div>
                      ))}
                   </div>
                )}
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
