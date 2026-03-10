import axios from 'axios';

async function getProxyUrl() {
    try {
        // Пробуем получить URL с локального прокси
        const response = await axios.get('http://localhost:3001/tunnel-url', { 
            timeout: 2000 
        });
        return response.data.url;
    } catch (error) {
        console.warn('⚠️ Не удалось получить URL от прокси, используем localhost');
        return 'http://localhost:3001';
    }
}

export const analyzeVacancy = async (vacancy, resumeText) => {
    const PROXY_URL = await getProxyUrl(); // Получаем актуальный URL
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
        // Отправляем запрос НА ПРОКСИ, а не напрямую в Google
        const response = await axios.post(`${PROXY_URL}/api/gemini/generate`, {
            model: 'gemini-3-flash-preview',  // используй стабильную модель
            contents: prompt
        });
        
        const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('📝 Ответ от прокси:', text);
        
        const score = parseInt(text.match(/\d+/)?.[0] || '0');
        return Math.min(100, Math.max(0, score));
        
    } catch (error) {
        console.error('❌ Ошибка прокси:', error.message);
        if (error.response) {
            console.error('Детали:', error.response.data);
        }
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

Напиши письмо (3-5 предложений).
`;

    try {
        const response = await axios.post(`${PROXY_URL}/api/gemini/generate`, {
            model: 'gemini-1.5-flash',
            contents: prompt
        });
        
        return response.data.candidates?.[0]?.content?.parts?.[0]?.text || 
               'Не удалось сгенерировать письмо';
        
    } catch (error) {
        console.error('❌ Ошибка прокси:', error.message);
        return 'Не удалось сгенерировать письмо';
    }
};