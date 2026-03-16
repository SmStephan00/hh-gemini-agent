// src/gemini/letterGenerator.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PROXY_URL = process.env.VITE_PROXY_URL;

function buildPrompt(vacancy, resumeText, userPrompt) {
    return `
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
${userPrompt ? `\n### ДОПОЛНИТЕЛЬНЫЕ УКАЗАНИЯ:\n${userPrompt}` : ''}
`;
}

export function getTemplateLetter(vacancy) {
    return `Здравствуйте! Меня заинтересовала вакансия ${vacancy.title} в компании ${vacancy.company}. Мой опыт и навыки соответствуют вашим требованиям. Буду рад обсудить детали на собеседовании.`;
}


export async function callGemini(modelConfig, prompt) {
    console.log(`   📡 Отправка в Gemini (модель: ${modelConfig.modelId})...`);
    
    if (!PROXY_URL) {
        throw new Error('PROXY_URL не настроен');
    }

    try {
        const url = `${PROXY_URL}/v1beta/models/${modelConfig.modelId}:generateContent?key=${modelConfig.apiKey}`;
        
        const response = await axios.post(url, {
            contents: [{
                parts: [{ text: prompt }]
            }]
        }, {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
        });

        const letter = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!letter) {
            throw new Error('Пустой ответ от Gemini');
        }
        
        return letter;
        
    } catch (error) {
        console.log(`   ❌ Gemini ошибка: ${error.message}`);
        
        if (error.response) {
            console.log(`   Статус: ${error.response.status}`);
            if (error.response.status === 429) {
                console.log(`   ⚠️ Превышен лимит запросов к Gemini`);
            }
        }
        
        throw error;
    }
}


export async function callOpenRouter(modelConfig, prompt) {
    console.log(`   📡 Отправка в OpenRouter (модель: ${modelConfig.modelId})...`);
    
    if (!modelConfig.apiKey) {
        throw new Error('OpenRouter API ключ не настроен');
    }
    
    try {
        const url = 'https://openrouter.ai/api/v1/chat/completions';
        
        const headers = {
            'Authorization': `Bearer ${modelConfig.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/tvoj-proekt',
            'X-Title': 'HH Auto Responder'
        };
        
        const data = {
            model: modelConfig.modelId,
            messages: [
                {
                    role: 'system',
                    content: 'Ты профессиональный HR-специалист. Пиши сопроводительные письма на русском языке, 3-5 предложений, персонализированные под вакансию.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        };
        
        const response = await axios.post(url, data, { headers, timeout: 30000 });
        
        const letter = response.data.choices?.[0]?.message?.content || '';
        
        if (!letter) {
            throw new Error('Пустой ответ от OpenRouter');
        }
        
        console.log(`   ✅ OpenRouter ответил (${letter.length} символов)`);
        return letter;
        
    } catch (error) {
        console.log(`   ❌ OpenRouter ошибка: ${error.message}`);
        
        if (error.response) {
            console.log(`   Статус: ${error.response.status}`);
            if (error.response.status === 429) {
                console.log(`   ⚠️ Превышен лимит запросов к OpenRouter`);
            }
            if (error.response.data?.error) {
                console.log(`   Детали:`, error.response.data.error);
            }
        }
        
        throw error;
    }
}


export async function generateCoverLetter(vacancy, resumeText, userPrompt = '') {
    try {
        console.log('📝 Генерация сопроводительного письма...');
        
        const MODELS = [
            {
                name: 'OpenRouter Free',
                modelId: 'openrouter/free',
                apiKey: process.env.OPENROUTER_API_KEY,
                callFunction: callOpenRouter
            },
            {
                name: 'Gemini Flash',
                modelId: 'gemini-3-flash-preview',
                apiKey: process.env.GEMINI_API_KEY,
                callFunction: callGemini
            },
            {
                name: 'Claude Haiku (via OpenRouter)',
                modelId: 'anthropic/claude-3-haiku',
                apiKey: process.env.OPENROUTER_API_KEY,
                callFunction: callOpenRouter
            }
        ].filter(model => {
            if (!model.apiKey) {
                console.log(`⚠️ Модель ${model.name} пропущена: нет API ключа`);
                return false;
            }
            return true;
        });

        if (MODELS.length === 0) {
            console.log('⚠️ Нет доступных моделей, использую шаблон');
            return getTemplateLetter(vacancy);
        }
        
        const prompt = buildPrompt(vacancy, resumeText, userPrompt);
        
        for (const model of MODELS) {
            console.log(`🔄 Пробуем модель: ${model.name}`);
            
            try {
                const letter = await model.callFunction(model, prompt);
                
                console.log(`   ✅ Модель ${model.name} сработала!`);
                console.log(`   📄 Длина письма: ${letter.length} символов`);
                
                return letter;
                
            } catch (modelError) {
                console.log(`   ❌ Ошибка ${model.name}:`, modelError.message);
                
                if (modelError.message.includes('rate limit') || 
                    modelError.message.includes('quota')) {
                    console.log(`   ⚠️ Превышен лимит для ${model.name}`);
                }
                
                continue;
            }
        }
        
        throw new Error('Все модели недоступны');
        
    } catch (error) {
        console.error('❌ Критическая ошибка:', error.message);
        return getTemplateLetter(vacancy);
    }
}