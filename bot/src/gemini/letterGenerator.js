import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// URL прокси (из .env или localhost)
const PROXY_URL = process.env.VITE_PROXY_URL || 'http://localhost:3001';

/**
 * Генерирует сопроводительное письмо через Gemini
 * @param {Object} vacancy - Данные вакансии
 * @param {string} resumeText - Текст резюме
 * @param {string} userPrompt - Дополнительные пожелания
 * @returns {Promise<string>} - Сгенерированное письмо
 */
export async function generateCoverLetter(vacancy, resumeText, userPrompt = '') {
    try {
        console.log('📝 Генерация сопроводительного письма...');
        
        const prompt = `
Ты — профессиональный HR-специалист и карьерный консультант. Напиши сопроводительное письмо от имени кандидата.

### ВАКАНСИЯ:
Название: ${vacancy.title}
Компания: ${vacancy.company}
Ключевые навыки: ${vacancy.skills?.join(', ') || 'не указаны'}
Описание: ${vacancy.description?.substring(0, 1000) || 'нет описания'}

### РЕЗЮМЕ КАНДИДАТА:
${resumeText.substring(0, 2000)}

### ДОПОЛНИТЕЛЬНЫЕ ПОЖЕЛАНИЯ:
${userPrompt || 'Напиши профессиональное, но не слишком формальное письмо. Подчеркни соответствие навыков кандидата требованиям вакансии. Упомяни конкретные технологии и опыт.'}

### ТРЕБОВАНИЯ К ПИСЬМУ:
- Длина: 3-5 предложений
- Язык: русский
- Стиль: профессиональный, но живой
- Не используй шаблонные фразы
- Персонализируй под конкретную компанию и вакансию
`;

        // Отправляем запрос через прокси
        const response = await axios.post(`${PROXY_URL}/api/gemini/generate`, {
            model: 'gemini-2.0-flash-exp',
            contents: prompt
        }, {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
        });

        const letter = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        console.log(`✅ Письмо сгенерировано (${letter.length} символов)`);
        
        return letter;

    } catch (error) {
        console.error('❌ Ошибка генерации письма:', error.message);
        
        // Возвращаем запасной вариант
        return getFallbackLetter(vacancy);
    }
}

/**
 * Запасной вариант письма (если Gemini не отвечает)
 */
function getFallbackLetter(vacancy) {
    const templates = [
        `Здравствуйте! Меня заинтересовала вакансия ${vacancy.title} в компании ${vacancy.company}. Мой опыт и навыки соответствуют вашим требованиям. Буду рад обсудить детали на собеседовании.`,
        
        `Добрый день! Я хочу предложить свою кандидатуру на позицию ${vacancy.title}. Уверен, что мой опыт будет полезен для развития проектов ${vacancy.company}. Готов к сотрудничеству!`,
        
        `Приветствую команду ${vacancy.company}! Изучив вашу вакансию ${vacancy.title}, я понял, что это именно то, чем я хочу заниматься. Мои компетенции идеально подходят для решения ваших задач.`
    ];
    
    return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Генерирует письмо на основе ID вакансии (получает данные через парсер)
 * @param {Page} page - Страница Playwright с открытой вакансией
 * @param {string} resumeText - Текст резюме
 * @returns {Promise<string>}
 */
export async function generateLetterFromPage(page, resumeText) {
    try {
        // Парсим вакансию прямо со страницы
        const vacancyData = await page.evaluate(() => {
            const title = document.querySelector('[data-qa="vacancy-title"]')?.textContent?.trim() || '';
            const company = document.querySelector('[data-qa="vacancy-company-name"]')?.textContent?.trim() || '';
            
            const skills = [];
            document.querySelectorAll('[data-qa="bloko-tag__text"]').forEach(el => {
                const skill = el.textContent?.trim();
                if (skill) skills.push(skill);
            });
            
            const description = document.querySelector('[data-qa="vacancy-description"]')?.textContent?.trim() || '';
            
            return { title, company, skills, description };
        });
        
        return await generateCoverLetter(vacancyData, resumeText);
        
    } catch (error) {
        console.error('❌ Ошибка генерации письма со страницы:', error.message);
        throw error;
    }
}