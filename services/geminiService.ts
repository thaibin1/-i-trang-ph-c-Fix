const API_KEY = AIzaSyAPCyQtCssOnBiQYzFkdnuTN46eNxndOyw
  localStorage.getItem("gemini_api_key") ||
  import.meta.env.VITE_GEMINI_API_KEY;

import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ImageAsset } from "../types";

// Manage Manual API Key
let manualApiKey: string | null = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;

export const setManualApiKey = (key: string) => {
  manualApiKey = key;
  if (typeof window !== 'undefined') {
    localStorage.setItem('gemini_api_key', key);
  }
};

export const clearManualApiKey = () => {
  manualApiKey = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('gemini_api_key');
  }
};

const getApiKey = () => {
  return manualApiKey || process.env.API_KEY;
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
  const candidate = response.candidates?.[0];
  
  if (!candidate) {
    throw new Error("API không trả về kết quả nào.");
  }

  const safetyRatings = candidate.safetyRatings || [];
  const blockedRating = safetyRatings.find((r: any) => r.blocked === true);

  if (candidate.finishReason === 'SAFETY' || blockedRating) {
    throw new Error("Hình ảnh bị chặn bởi bộ lọc an toàn.");
  }

  const parts = candidate.content?.parts;
  if (!parts || parts.length === 0) {
    throw new Error("AI không tạo được ảnh.");
  }
  
  for (const part of parts) {
    if (part.inlineData && part.inlineData.data) {
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
  }
  
  const textPart = parts.find((p: any) => p.text);
  if (textPart) {
    throw new Error(`AI: ${textPart.text}`);
  }

  throw new Error("Không tìm thấy dữ liệu hình ảnh.");
};

const handleError = (error: any) => {
  console.error("Gemini API Error:", error);
  const errorMsg = error.message || "";
  if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('API key')) {
       throw new Error("Lỗi API Key: Vui lòng kiểm tra lại key.");
  }
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
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });

  const basePrompt = `
    You are a professional AI fashion photo editor.
    TASK: Dress the person in IMAGE 1 with the exact clothing shown in IMAGE 2.
    
    CRITICAL GUIDELINES:
    1. IMAGE 1 is the absolute reference for the person's identity, face, body pose, and background.
    2. IMAGE 2 is the reference for the target garment/clothing.
    3. Replace ONLY the existing clothes on the person in IMAGE 1 with the items from IMAGE 2.
    4. KEEP the original person's head, face, skin tone, hairstyle, and the EXACT background from IMAGE 1 completely unchanged.
    5. The new clothing must fit naturally onto the person's body structure in IMAGE 1.
    6. Ensure photorealistic textures, fabric folds, and lighting consistency between the person and the environment.
    7. Aspect Ratio: ${aspectRatio}.
    ${instructions ? `8. Additional style notes: ${instructions}` : ''}
    
    OUTPUT: Provide ONLY the final generated image.
  `;

  const parts: any[] = [
    { inlineData: { mimeType: personImage.mimeType, data: cleanBase64(personImage.data) } } // IMAGE 1
  ];

  if (garmentImage) {
    parts.push({ inlineData: { mimeType: garmentImage.mimeType, data: cleanBase64(garmentImage.data) } }); // IMAGE 2
  }

  if (garmentDetailImage) {
    parts.push({ inlineData: { mimeType: garmentDetailImage.mimeType, data: cleanBase64(garmentDetailImage.data) } });
  }

  if (accessoryImage) {
    parts.push({ inlineData: { mimeType: accessoryImage.mimeType, data: cleanBase64(accessoryImage.data) } });
  }

  parts.push({ text: basePrompt });

  try {
    const config: any = { 
      imageConfig: { aspectRatio },
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ]
    };
    
    if (modelName === 'gemini-3-pro-image-preview') {
        config.imageConfig.imageSize = imageSize;
    }

    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: modelName,
      contents: { parts: parts },
      config: config
    }));
    
    return extractImageFromResponse(response);
  } catch (error: any) {
    throw error;
  }
};

export const generateVirtualTryOn = async (
  personImage: ImageAsset,
  garmentImage: ImageAsset | null,
  garmentDetailImage: ImageAsset | null,
  accessoryImage: ImageAsset | null,
  instructions: string,
  aspectRatio: string = "9:16",
  imageSize: string = "2K",
  modelName: string = "gemini-3-pro-image-preview",
  count: number = 1
): Promise<string[]> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Thiếu API Key.");

  const tasks = [];
  for (let i = 0; i < count; i++) {
    tasks.push(executeSingleTryOn(
      personImage, 
      garmentImage, 
      garmentDetailImage, 
      accessoryImage, 
      instructions, 
      aspectRatio, 
      imageSize, 
      modelName
    ));
  }
  
  const results = await Promise.allSettled(tasks);
  const validResults: string[] = [];
  let lastErrorMsg = "";

  results.forEach((res) => {
    if (res.status === 'fulfilled' && res.value) {
      validResults.push(res.value);
    } else if (res.status === 'rejected') {
      lastErrorMsg = res.reason?.message || "Lỗi hệ thống.";
    }
  });

  if (validResults.length === 0) {
    throw new Error(lastErrorMsg || "Không thể tạo ảnh.");
  }

  return validResults;
};

export const changeImageBackground = async (
  imageDataUrl: string,
  backgroundPrompt: string = "A modern studio background.",
  detailImage: ImageAsset | null = null,
  aspectRatio: string = "9:16",
  imageSize: string = "2K",
  modelName: string = "gemini-3-pro-image-preview",
  customBgImage: ImageAsset | null = null
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Thiếu API Key.");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Keep the subject identical. Replace background with: ${customBgImage ? 'the environment from the reference' : backgroundPrompt}.`;
  const parts: any[] = [{ inlineData: { mimeType: 'image/png', data: cleanBase64(imageDataUrl) } }];
  if (detailImage) parts.push({ inlineData: { mimeType: detailImage.mimeType, data: cleanBase64(detailImage.data) } });
  if (customBgImage) parts.push({ inlineData: { mimeType: customBgImage.mimeType, data: cleanBase64(customBgImage.data) } });
  parts.push({ text: prompt });

  try {
    const config: any = { 
      imageConfig: { aspectRatio },
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ]
    };
    if (modelName === 'gemini-3-pro-image-preview') config.imageConfig.imageSize = imageSize;
    const response = await ai.models.generateContent({ model: modelName, contents: { parts }, config });
    return extractImageFromResponse(response);
  } catch (error) { handleError(error); return ""; }
};

export const changeImageBackgroundBatch = async (
  imageDataUrl: string,
  prompts: string[],
  detailImage: ImageAsset | null = null,
  aspectRatio: string = "9:16",
  imageSize: string = "2K",
  modelName: string = "gemini-3-pro-image-preview",
  customBgImage: ImageAsset | null = null
): Promise<string[]> => {
  const results = await Promise.all(prompts.map(p => changeImageBackground(imageDataUrl, p, detailImage, aspectRatio, imageSize, modelName, customBgImage).catch(() => null)));
  return results.filter((r): r is string => r !== null);
};

export const analyzeOutfit = async (image: ImageAsset, detailImage: ImageAsset | null): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Thiếu API Key.");
  const ai = new GoogleGenAI({ apiKey });
  const parts: any[] = [{ inlineData: { mimeType: image.mimeType, data: cleanBase64(image.data) } }];
  if (detailImage) parts.push({ inlineData: { mimeType: detailImage.mimeType, data: cleanBase64(detailImage.data) } });
  parts.push({ text: "Describe this outfit for high-quality video generation." });
  const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: { parts } });
  return response.text || "";
};

export const generatePromptsFromAnalysis = async (analysis: string, count: number): Promise<string[]> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Thiếu API Key.");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: analysis,
    config: {
      systemInstruction: `Generate ${count} video motion prompts. Return JSON { "prompts": [] }.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: { prompts: { type: Type.ARRAY, items: { type: Type.STRING } } }
      }
    }
  });
  const parsed = JSON.parse(response.text || "{}");
  return parsed.prompts || [];
};
