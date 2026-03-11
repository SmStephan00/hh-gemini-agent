import axios from 'axios';

// Берем URL из .env - ты его сам копируешь туда
const PROXY_URL = import.meta.env.VITE_PROXY_URL;

export const analyzeVacancy = async (vacancy, resumeText) => {
    console.log('🔵 Анализ вакансии через прокси:', vacancy.title);
    console.log('📡 Прокси URL:', PROXY_URL);
    
    const prompt = `
Ты — HR-эксперт. Оцени соответствие кандидата вакансии.

ВАКАНСИЯ:
Название: ${vacancy.title}
Компания: ${vacancy.company}
Требования: ${vacancy.keySkills?.join(', ') || 'не указаны'}

РЕЗЮМЕ КАНДИДАТА:
${resumeText}

Оцени соответствие от 0 до 100. Верни ТОЛЬКО число (без пояснений).
`;

    try {
        const response = await axios.post(`${PROXY_URL}/api/gemini/generate`, {
            model: 'gemini-3-flash-preview',
            contents: prompt
        });
        
        const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('📝 Ответ от прокси:', text);
        
        const score = parseInt(text.match(/\d+/)?.[0] || '0');
        return Math.min(100, Math.max(0, score));
        
    } catch (error) {
        console.error('❌ Ошибка прокси:', error.message);
        return 0;
    }
};

// аналогично для generateCoverLetter