
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ImageAsset } from "../types";

// Helper to get the API Key (Manual vs Environment)
const getApiKey = () => {
  if (typeof window !== 'undefined') {
    const savedKey = localStorage.getItem('manual_api_key');
    if (savedKey) return savedKey;
  }
  return process.env.API_KEY;
};

// Helper to remove data URL prefix for API
const cleanBase64 = (dataUrl: string) => {
  if (dataUrl.includes(',')) {
    return dataUrl.split(',')[1];
  }
  return dataUrl;
};

// --- Helpers ---

const retry = async <T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || "";
      const isTransient = 
        errorMsg.includes('500') || 
        errorMsg.includes('503') || 
        errorMsg.toLowerCase().includes('overloaded') || 
        errorMsg.toLowerCase().includes('deadline expired') ||
        errorMsg.toLowerCase().includes('internal error');
      
      if (!isTransient || i === maxRetries - 1) {
        throw error;
      }
      
      const delay = initialDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};

const extractImageFromResponse = (response: any): string => {
  if (response.generatedImages && response.generatedImages.length > 0) {
    const imgData = response.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${imgData}`;
  }

  const candidate = response.candidates?.[0];
  if (!candidate) throw new Error("API không trả về kết quả nào.");

  if (candidate.finishReason === 'SAFETY') {
    throw new Error("Hình ảnh bị chặn bởi bộ lọc an toàn của Google. Vui lòng thử ảnh khác ít nhạy cảm hơn.");
  }

  if (candidate.finishReason === 'IMAGE_OTHER') {
    throw new Error("Quá trình tạo ảnh bị gián đoạn (IMAGE_OTHER). Model gặp khó khăn với chi tiết hoặc vi phạm chính sách ẩn. Thử lại với ảnh rõ ràng hơn.");
  }

  const parts = candidate.content?.parts;
  if (!parts || parts.length === 0) throw new Error("AI không tạo được dữ liệu ảnh.");
  
  for (const part of parts) {
    if (part.inlineData && part.inlineData.data) {
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
  }
  
  const textPart = parts.find((p: any) => p.text);
  if (textPart && textPart.text) throw new Error(`AI phản hồi: ${textPart.text}`);

  throw new Error("Không tìm thấy dữ liệu hình ảnh trong phản hồi của AI.");
};

const handleError = (error: any) => {
  console.error("Gemini API Error Detail:", error);
  const errorMsg = error.message || "";
  
  if (errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED')) {
    throw new Error("Lỗi 403 (Permission Denied): Model này yêu cầu API Key từ project có trả phí hoặc bạn đã hết hạn mức.");
  }

  if (errorMsg.includes('404') || errorMsg.includes('not found')) {
    throw new Error("Lỗi 404: Không tìm thấy model. Vui lòng kiểm tra lại quyền truy cập của API Key.");
  }

  if (errorMsg.includes('API key')) throw new Error("Lỗi API Key: Key không hợp lệ.");
  
  throw new Error(errorMsg || "Xử lý thất bại.");
};

// --- Main Services ---

const executeSingleTryOn = async (
  personImage: ImageAsset,
  garmentImage: ImageAsset | null,
  garmentDetailImage: ImageAsset | null,
  accessoryImage: ImageAsset | null,
  instructions: string,
  aspectRatio: string,
  imageSize: string,
  modelName: string
): Promise<string | null> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey: apiKey || '' });

  if (modelName === 'imagen-4.0-generate-001') {
    const prompt = `A professional full body photograph of a person wearing ${instructions || 'this garment'}. High fashion style, 4k resolution, studio lighting.`;
    try {
      const response = await retry(() => ai.models.generateImages({
        model: modelName,
        prompt: prompt,
        config: { numberOfImages: 1, aspectRatio: aspectRatio as any }
      }));
      return extractImageFromResponse(response);
    } catch (e) { handleError(e); return null; }
  }

  const basePrompt = `A high-quality professional studio photograph. 
    The person from IMAGE 1 is now wearing the exact clothing items shown in IMAGE 2. 
    The person's facial features, pose, hair, and background from IMAGE 1 must remain exactly the same. 
    The clothing fit should be perfectly matched to the person's body shape. 
    ${instructions ? `Style guidance: ${instructions}` : ''}`;

  const parts: any[] = [
    { inlineData: { mimeType: personImage.mimeType, data: cleanBase64(personImage.data) } },
    garmentImage ? { inlineData: { mimeType: garmentImage.mimeType, data: cleanBase64(garmentImage.data) } } : null,
    garmentDetailImage ? { inlineData: { mimeType: garmentDetailImage.mimeType, data: cleanBase64(garmentDetailImage.data) } } : null,
    accessoryImage ? { inlineData: { mimeType: accessoryImage.mimeType, data: cleanBase64(accessoryImage.data) } } : null,
    { text: basePrompt }
  ].filter(Boolean);

  try {
    const config: any = { 
      imageConfig: { aspectRatio: aspectRatio, imageSize: imageSize },
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ]
    };
    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({ model: modelName, contents: { parts }, config }));
    return extractImageFromResponse(response);
  } catch (error: any) { handleError(error); return null; }
};

export const generateVirtualTryOn = async (
  personImage: ImageAsset,
  garmentImage: ImageAsset | null,
  garmentDetailImage: ImageAsset | null,
  accessoryImage: ImageAsset | null,
  instructions: string,
  aspectRatio: string = "9:16",
  imageSize: string = "4K",
  modelName: string = "gemini-3-pro-image-preview",
  count: number = 1
): Promise<string[]> => {
  const tasks = Array.from({ length: count }, () => executeSingleTryOn(personImage, garmentImage, garmentDetailImage, accessoryImage, instructions, aspectRatio, imageSize, modelName));
  const results = await Promise.allSettled(tasks);
  const validResults: string[] = [];
  let lastErrorMsg = "";

  results.forEach((res) => {
    if (res.status === 'fulfilled' && res.value) validResults.push(res.value);
    else if (res.status === 'rejected') lastErrorMsg = res.reason?.message || "Lỗi hệ thống.";
  });

  if (validResults.length === 0) throw new Error(lastErrorMsg || "AI không tạo được dữ liệu ảnh.");
  return validResults;
};

export const changeImageBackground = async (
  imageDataUrl: string,
  backgroundPrompt: string = "A modern studio background.",
  detailImage: ImageAsset | null = null,
  aspectRatio: string = "9:16",
  imageSize: string = "4K",
  modelName: string = "gemini-3-pro-image-preview",
  customBgImage: ImageAsset | null = null
): Promise<string> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey: apiKey || '' });

  if (modelName === 'imagen-4.0-generate-001') {
    try {
      const response = await retry(() => ai.models.generateImages({
        model: modelName,
        prompt: backgroundPrompt,
        config: { numberOfImages: 1, aspectRatio: aspectRatio as any }
      }));
      return extractImageFromResponse(response);
    } catch (e) { handleError(e); return ""; }
  }

  const prompt = `Keep the subject identical. Replace background with: ${customBgImage ? 'the environment from the reference' : backgroundPrompt}.`;
  const parts: any[] = [
    { inlineData: { mimeType: 'image/png', data: cleanBase64(imageDataUrl) } },
    detailImage ? { inlineData: { mimeType: detailImage.mimeType, data: cleanBase64(detailImage.data) } } : null,
    customBgImage ? { inlineData: { mimeType: customBgImage.mimeType, data: cleanBase64(customBgImage.data) } } : null,
    { text: prompt }
  ].filter(Boolean);

  try {
    const config: any = { imageConfig: { aspectRatio: aspectRatio, imageSize: imageSize }, safetySettings: [{ category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }] };
    const response = await ai.models.generateContent({ model: modelName, contents: { parts }, config });
    return extractImageFromResponse(response);
  } catch (error) { handleError(error); return ""; }
};

export const analyzeOutfit = async (image: ImageAsset, detailImage: ImageAsset | null): Promise<string> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey: apiKey || '' });
  const parts: any[] = [
    { inlineData: { mimeType: image.mimeType, data: cleanBase64(image.data) } },
    detailImage ? { inlineData: { mimeType: detailImage.mimeType, data: cleanBase64(detailImage.data) } } : null,
    { text: "Describe this outfit for high-quality video generation." }
  ].filter(Boolean);
  try {
    const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: { parts } });
    return response.text || "";
  } catch (e) { handleError(e); return ""; }
};

export const generatePromptsFromAnalysis = async (analysis: string, count: number): Promise<string[]> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey: apiKey || '' });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: analysis,
      config: {
        systemInstruction: `Generate ${count} video motion prompts for this outfit. Return JSON { "prompts": [] }.`,
        responseMimeType: 'application/json',
        responseSchema: { type: Type.OBJECT, properties: { prompts: { type: Type.ARRAY, items: { type: Type.STRING } } } }
      }
    });
    return JSON.parse(response.text || "{}").prompts || [];
  } catch (e) { handleError(e); return []; }
};
