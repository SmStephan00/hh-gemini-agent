// src/gemini/letterGenerator.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PROXY_URL = process.env.VITE_PROXY_URL;

// 🔥 НОВАЯ ФУНКЦИЯ ДЛЯ ИЗВЛЕЧЕНИЯ КЛЮЧЕВЫХ НАВЫКОВ ИЗ ОПИСАНИЯ
function extractKeySkills(vacancy) {
    // Если навыки уже есть в структурированном виде
    if (vacancy.skills && vacancy.skills.length > 0) {
        return vacancy.skills.slice(0, 4).join(', ');
    }
    
    // Иначе пытаемся извлечь из описания
    const commonSkills = [
        'React', 'TypeScript', 'JavaScript', 'Node.js', 'Next.js',
        'Vue', 'Angular', 'Redux', 'Webpack', 'HTML', 'CSS',
        'Git', 'Docker', 'REST API', 'GraphQL', 'Jest'
    ];
    
    const foundSkills = [];
    const description = (vacancy.description || '').toLowerCase();
    
    for (const skill of commonSkills) {
        if (description.includes(skill.toLowerCase())) {
            foundSkills.push(skill);
            if (foundSkills.length >= 4) break;
        }
    }
    
    return foundSkills.length > 0 ? foundSkills.join(', ') : 'современный стек';
}

// 🔥 НОВАЯ ФУНКЦИЯ ДЛЯ ИЗВЛЕЧЕНИЯ ДОСТИЖЕНИЙ ИЗ РЕЗЮМЕ
function extractAchievements(resumeText) {
    // Ищем упоминания цифр и достижений
    const achievements = [];
    
    // Простой парсинг: ищем предложения с цифрами
    const sentences = resumeText.split(/[.!?]+/);
    
    for (const sentence of sentences) {
        if (sentence.includes('%') || 
            sentence.includes('увеличил') || 
            sentence.includes('сократил') ||
            sentence.includes('оптимизировал') ||
            sentence.includes('внедрил') ||
            /\d+%|\d+\s*(раз|раза)/.test(sentence)) {
            achievements.push(sentence.trim());
            if (achievements.length >= 3) break;
        }
    }
    
    // Если не нашли, используем стандартные
    if (achievements.length === 0) {
        return 'оптимизация производительности, внедрение CI/CD, участие в 5+ проектах';
    }
    
    return achievements.join('. ');
}

/**
 * 🔥 ОБНОВЛЕННЫЙ ПРОМПТ - строго по твоим требованиям
 */
function buildPrompt(vacancy, resumeText, userPrompt) {
    // Извлекаем данные для промпта
    const keySkills = extractKeySkills(vacancy);
    const achievements = extractAchievements(resumeText);
    const yearsOfExperience = '3+'; // Можно вычислить из резюме
    
    return `
Ты — эксперт по найму. Напиши сопроводительное письмо для позиции "${vacancy.title}" в компанию "${vacancy.company}".

Мой опыт: ${yearsOfExperience} лет, ключевые навыки: ${keySkills}.
Главные достижения (с цифрами): ${achievements}.

ТРЕБОВАНИЯ К ПИСЬМУ:
1. Структура:
   - Приветствие + кто я (1 предложение)
   - Чем полезен компании (2 предложения с цифрами)
   - Мотивация и почему именно эта компания (1 предложение)
   - Призыв к действию (1 предложение)

2. Важно:
   - Максимум 600 символов
   - Живой язык без канцеляризмов
   - Использовать ключевые слова из вакансии: ${keySkills}
   - Не дублировать резюме — только самое важное

3. Дополнительная информация о компании:
   ${vacancy.description?.substring(0, 500) || ''}

${userPrompt ? `\nДОПОЛНИТЕЛЬНЫЕ УКАЗАНИЯ:\n${userPrompt}` : ''}
`;
}

export function getTemplateLetter(vacancy) {
    return `Здравствуйте! Меня заинтересовала вакансия ${vacancy.title} в компании ${vacancy.company}. Мой опыт и навыки соответствуют вашим требованиям. Буду рад обсудить детали на собеседовании.`;
}

export async function callAIWorkerProxy(modelConfig, prompt) {
    console.log(`   📡 Отправка в AI Worker Proxy...`);
    
    try {
        const response = await axios.post(
            `https://ai-worker-proxy.evgeniikorn99.workers.dev/v1/chat/completions`,
            {
                model: modelConfig.modelId,
                messages: [
                    { role: 'user', content: prompt }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.log(`   ❌ AI Worker Proxy ошибка: ${error.message}`);
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
                    content: 'Ты эксперт по найму. Пиши сопроводительные письма строго по заданной структуре. Максимум 600 символов. Живой язык, без канцеляризмов.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 800,  // Уменьшили для соблюдения лимита 600 символов
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

export async function callDashScope(modelConfig ,prompt) {
    if(!PROXY_URL){
        throw new Error('PROXY_URL не настроен');
    }

    try{
        const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
        
 
        const response = await axios.post(url, {
            model: modelConfig.modelId,
            input: {
                messages: [
                    { role: 'user', content: prompt }
                ]
            },
            parameters: {
                max_tokens: 800,
                temperature: 0.7
            }
        }, {
            headers: {
                'Authorization': `Bearer ${modelConfig.apiKey}`,  // Должно быть именно так!
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

    const letter = response.data.output?.choices?.[0]?.message?.content || '';
    
    if (!letter) {
            throw new Error('Пустой ответ от DashScope');
        }
        
    return letter;

    }catch(err){
        console.log(`   ❌ DashScope ошибка: ${err.message}`);
        
        if (err.response) {
            console.log(`   Статус: ${err.response.status}`);
            if (err.response.status === 429) {
                console.log(`   ⚠️ Превышен лимит запросов к DashScope`);
            }
        }
        
        throw err;
    }
}

export async function callHuggingFace(modelConfig, prompt) {
    console.log(`   📡 Отправка в Hugging Face (${modelConfig.modelId})...`);
    
    if (!PROXY_URL) {
        throw new Error('PROXY_URL не настроен');
    }

    try {
        const url = `https://api-inference.huggingface.co/models/${modelConfig.modelId}`;

        const response = await axios.post(url,
            {
                inputs: prompt,
                parameters: {
                    max_new_tokens: 800,
                    temperature: 0.7,
                    return_full_text: false
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${modelConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );

        let letter = '';
        if (Array.isArray(response.data)) {
            letter = response.data[0]?.generated_text || '';
        } else {
            letter = response.data?.generated_text || '';
        }
        
        if (letter.includes(prompt)) {
            letter = letter.replace(prompt, '').trim();
        }
        
        if (!letter) {
            throw new Error('Пустой ответ от Hugging Face');
        }
        
        console.log(`   ✅ Hugging Face ответил (${letter.length} символов)`);
        return letter; 
    } catch (err) {
        console.log(`   ❌ Hugging Face ошибка: ${err.message}`);
        if (err.response) {
            console.log(`   Статус: ${err.response.status}`);
        }
        throw err;
    }
}

export async function generateCoverLetter(vacancy, resumeText, userPrompt = '') {
    try {
        console.log('📝 Генерация сопроводительного письма...');
        
        const MODELS = [
            {
                name: 'DashScope',
                modelId: 'qwen-max',
                apiKey: process.env.DASHSCOPE_API_KEY,
                callFunction: callDashScope
            },
            {
                name: 'Hugging Face',
                modelId: 'meta-llama/Llama-3.3-70B-Instruct',
                apiKey: process.env.HUGGINGFACE_API_KEY,
                callFunction: callHuggingFace
            },
            {
                name: 'AI Worker Proxy',
                modelId: 'google/gemini-2.5-flash-lite',
                apiKey: process.env.PROXY_AUTH_TOKEN,  // Токен прокси
                callFunction: callAIWorkerProxy
            },
            {
                name: 'OpenRouter Free',
                modelId: 'openrouter/free',
                apiKey: process.env.OPENROUTER_API_KEY,
                callFunction: callOpenRouter
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