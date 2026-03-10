import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const analyzeVacancy = async (vacancy, resumeText) => {
    console.log('🔵 Анализ вакансии:', vacancy.title);
    
    const prompt = `
Ты — HR-эксперт. Оцени соответствие кандидата вакансии.

ВАКАНСИЯ:
Название: ${vacancy.title}
Компания: ${vacancy.company}
Требования: ${vacancy.keySkills?.join(', ') || 'не указаны'}
Описание: ${vacancy.description || 'нет описания'}

РЕЗЮМЕ КАНДИДАТА:
${resumeText}

Оцени соответствие от 0 до 100. Верни ТОЛЬКО число (без пояснений).
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",  // или gemini-2.0-flash-exp, gemini-1.5-flash
            contents: prompt,
        });
        
        const text = response.text;
        console.log('📝 Ответ Gemini:', text);
        
        const score = parseInt(text.match(/\d+/)?.[0] || '0');
        return Math.min(100, Math.max(0, score));
    } catch (err) {
        console.error('❌ Ошибка Gemini:', err);
        return 0;
    }
};

export const generateCoverLetter = async (vacancy, resumeText, userPrompt) => {
    const prompt = `
${userPrompt || 'Напиши сопроводительное письмо от имени кандидата.'}

ВАКАНСИЯ:
${vacancy.title} в компании ${vacancy.company}
Требования: ${vacancy.keySkills?.join(', ')}

РЕЗЮМЕ КАНДИДАТА:
${resumeText}

Напиши письмо (3-5 предложений), подчеркивая соответствие кандидата требованиям.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
        });
        
        return response.text;
    } catch (err) {
        console.error('❌ Ошибка Gemini:', err);
        return 'Не удалось сгенерировать письмо';
    }
};