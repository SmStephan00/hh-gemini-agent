import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PROXY_URL = process.env.VITE_PROXY_URL;

export async function generateCoverLetter(vacancy, resumeText, userPrompt = '') {
    try {
        console.log('📝 Генерация сопроводительного письма...');
        
        if (!PROXY_URL) {
            throw new Error('VITE_PROXY_URL не задан в .env');
        }
        
        const prompt = `
Ты — профессиональный HR-специалист. Напиши сопроводительное письмо от имени кандидата.

### ВАКАНСИЯ:
Название: ${vacancy.title}
Компания: ${vacancy.company}
Ключевые навыки: ${vacancy.skills?.join(', ') || 'не указаны'}
Описание: ${vacancy.description?.substring(0, 1000) || 'нет описания'}

### РЕЗЮМЕ КАНДИДАТА:
${resumeText.substring(0, 2000)}

### ТРЕБОВАНИЯ К ПИСЬМУ:
- Длина: 3-5 предложений
- Язык: русский
- Стиль: профессиональный, но живой
- Персонализируй под конкретную компанию и вакансию
`;

        console.log(`📡 Отправка запроса на: ${PROXY_URL}/api/gemini/generate`);
        
        const response = await axios.post(`${PROXY_URL}/api/gemini/generate`, {
            model: 'gemini-3-flash-preview',
            contents: prompt
        }, {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
        });

        const letter = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!letter) {
            throw new Error('Пустой ответ от Gemini');
        }
        
        console.log(`✅ Письмо сгенерировано (${letter.length} символов)`);
        return letter;

    } catch (error) {
        console.error('❌ Ошибка Gemini:', error.message);
        if (error.response) {
            console.error('Статус:', error.response.status);
            console.error('Данные:', error.response.data);
        }
        
        // Запасной вариант
        return getTemplateLetter(vacancy);
    }
}

function getTemplateLetter(vacancy) {
    return `Здравствуйте! Меня заинтересовала вакансия ${vacancy.title} в компании ${vacancy.company}. Мой опыт и навыки соответствуют вашим требованиям. Буду рад обсудить детали на собеседовании.`;
}