// src/responder/questionHandler.js
import { callOpenRouter } from '../gemini/letterGenerator.js';

/* ======================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ОТВЕТОВ
   ====================================================== */

// Кэш для ответов (чтобы экономить лимиты API)
const answerCache = new Map();

/**
 * Запасные ответы если AI не сработал
 */
function getFallbackAnswer(question) {
    const q = question.toLowerCase();
    if (q.includes('зарплат') || q.includes('компенсац')) {
        return 'Рассчитываю на уровень рынка, готов обсудить на собеседовании.';
    }
    if (q.includes('опыт') || q.includes('сколько лет')) {
        return 'Более 3 лет коммерческой разработки.';
    }
    if (q.includes('почему')) {
        return 'Мой опыт полностью соответствует требованиям вакансии.';
    }
    return 'Имею необходимый опыт и навыки, подробнее в резюме.';
}

/**
 * Локальные ответы для технических вопросов (когда API недоступен)
 */
function getLocalTechnicalAnswer(question, vacancyData) {
    const q = question.toLowerCase();
    
    // Вопрос про компонент со списком объектов
    if (q.includes('компонент') && q.includes('список объектов')) {
        return 'Добавить уникальные ключи (key) для каждого объекта и обернуть карточки в React.memo для предотвращения ненужных перерисовок.';
    }
    
    // Вопрос про форму с задержками
    if (q.includes('форма') && q.includes('задержки')) {
        return 'Использовать debounce для обработки ввода и мемоизировать обработчики с useCallback.';
    }
    
    // Вопрос про ненужные рендеры
    if (q.includes('пересчитываются') && q.includes('рендерятся')) {
        return 'Использовать React.memo для функциональных компонентов и PureComponent для классовых, а также мемоизировать пропсы с useMemo/useCallback.';
    }
    
    // Вопрос про динамичную таблицу
    if (q.includes('таблицу') && q.includes('множеством данных')) {
        return 'Применить виртуализацию списка с помощью react-window или react-virtualized, чтобы рендерить только видимые строки.';
    }
    
    // Вопрос про формат работы
    if (q.includes('формат работы')) {
        return 'Удаленный';
    }
    
    return getFallbackAnswer(question);
}

/**
 * Генерация ответа на вопрос через AI
 */
export async function generateAnswer(question, resumeText, vacancyData, options = {}) {
    const { includeOptions = false, optionsList = [] } = options;
    
    // Проверяем кэш
    const cacheKey = `${question.substring(0, 100)}_${vacancyData.title}`;
    if (answerCache.has(cacheKey)) {
        console.log('   📦 Использую кэшированный ответ');
        return answerCache.get(cacheKey);
    }
    
    // Для технических вопросов можно использовать локальные ответы если API недоступен
    if (!process.env.OPENROUTER_API_KEY) {
        const localAnswer = getLocalTechnicalAnswer(question, vacancyData);
        answerCache.set(cacheKey, localAnswer);
        return localAnswer;
    }
    
    const vacancyContext = `
ТРЕБОВАНИЯ ВАКАНСИИ:
- Название: ${vacancyData.title}
- Компания: ${vacancyData.company}
- Ключевые навыки: ${vacancyData.skills?.join(', ') || 'не указаны'}
- Описание: ${vacancyData.description?.substring(0, 300) || ''}
`;
    
    let prompt = '';
    
    if (includeOptions && optionsList.length > 0) {
        // Если есть варианты ответов, просим выбрать номер
        prompt = `
Ты — кандидат на вакансию ${vacancyData.title} в компанию ${vacancyData.company}.
Выбери НАИБОЛЕЕ ПОДХОДЯЩИЙ вариант ответа на вопрос работодателя.

${vacancyContext}

ВОПРОС РАБОТОДАТЕЛЯ:
${question}

ВАРИАНТЫ ОТВЕТОВ:
${optionsList.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n')}

МОЁ РЕЗЮМЕ:
${resumeText.substring(0, 1000)}

ТРЕБОВАНИЯ:
- Выбери ТОЛЬКО ОДИН вариант, который лучше всего соответствует моему опыту
- Ответь ТОЛЬКО номером варианта (например: 3)
- Не пиши ничего кроме цифры
`;
    } else {
        // Обычный текстовый ответ
        prompt = `
Ты — кандидат на вакансию ${vacancyData.title} в компанию ${vacancyData.company}.
Ответь на вопрос работодателя, основываясь на своём резюме и требованиях вакансии.

${vacancyContext}

ВОПРОС РАБОТОДАТЕЛЯ:
${question}

МОЁ РЕЗЮМЕ:
${resumeText.substring(0, 1500)}

ТРЕБОВАНИЯ К ОТВЕТУ:
- Ответ должен быть правдивым, основываться на резюме
- Подчеркни соответствие требованиям вакансии
- Язык: русский
- Стиль: профессиональный, но живой
- Длина: 2-4 предложения
- Не используй вступления типа "Исходя из моего опыта"
- Отвечай сразу по делу
`;
    }
    
    try {
        const answer = await callOpenRouter(
            { modelId: 'openrouter/free', apiKey: process.env.OPENROUTER_API_KEY },
            prompt
        );
        
        // Сохраняем в кэш
        answerCache.set(cacheKey, answer);
        return answer;
    } catch (error) {
        console.log('   ⚠️ AI не доступен, использую локальный ответ');
        const localAnswer = getLocalTechnicalAnswer(question, vacancyData);
        answerCache.set(cacheKey, localAnswer);
        return localAnswer;
    }
}

/* ======================================================
   БЕЗОПАСНЫЙ ВВОД ТЕКСТА (ТОЛЬКО ДЛЯ ВИДИМЫХ ТЕКСТОВЫХ ПОЛЕЙ)
   ====================================================== */

/**
 * Безопасный ввод текста в поле (ТОЛЬКО ДЛЯ ВИДИМЫХ ТЕКСТОВЫХ ПОЛЕЙ!)
 */
export async function typeTextSafely(page, element, text) {
    try {
        // Проверяем видимость элемента
        const isVisible = await element.isVisible().catch(() => false);
        if (!isVisible) {
            console.log('   ⚠️ Элемент не видим, пропускаем typeTextSafely');
            return false;
        }
        
        // Проверяем, что это действительно текстовое поле
        const tagName = await element.evaluate(el => el.tagName).catch(() => '');
        const type = await element.evaluate(el => el.type).catch(() => null);
        
        const isTextInput = tagName === 'TEXTAREA' || 
                           (tagName === 'INPUT' && (type === 'text' || type === 'email' || type === 'tel' || type === 'search' || !type));
        
        if (!isTextInput) {
            console.log('   ⚠️ Элемент не является текстовым полем');
            return false;
        }
        
        // Пробуем кликнуть
        await element.click({ clickCount: 3, timeout: 30000 });
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(500);
        await element.type(text, { delay: 20, timeout: 30000 });
        console.log('   ✅ Текст введен через type');
        return true;
    } catch (error) {
        console.log('   ⚠️ Ошибка при вводе текста:', error.message);
        
        // Альтернативный способ через evaluate
        try {
            await page.evaluate((el, txt) => {
                el.value = txt;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, element, text);
            console.log('   ✅ Текст вставлен через evaluate');
            return true;
        } catch (e) {
            console.log('   ❌ Не удалось вставить текст');
            return false;
        }
    }
}

/* ======================================================
   ОПРЕДЕЛЕНИЕ ТИПА СТРАНИЦЫ (ФИНАЛЬНАЯ ВЕРСИЯ)
   ====================================================== */

export async function detectPageType(page) {
    const pageType = await page.evaluate(() => {
        // Проверка на тестовое задание
        const bodyText = document.body.innerText.toLowerCase();
        const testPageIndicators = [
            'ссылка на бэк', 'ссылка на файл', 'выполните задание',
            'необходимо сверстать', 'прикрепите ссылку', 'ссылка на figma',
            'тестовое задание', 'test task'
        ];
        if (testPageIndicators.some(ind => bodyText.includes(ind))) {
            return 'test_task';
        }

        // ===== ПРОВЕРКА НА ВОПРОСЫ (ПРЯМО НА СТРАНИЦЕ) =====
        
        // 1. Специальный заголовок "Ответьте на вопросы"
        const questionsTitle = document.querySelector('[data-qa="employer-asking-for-test"]');
        if (questionsTitle) {
            console.log('🔍 Найден заголовок вопросов');
            return 'questions';
        }
        
        // 2. Блоки вопросов
        const questionBlocks = document.querySelectorAll('[data-qa="task-body"]');
        if (questionBlocks.length > 0) {
            console.log(`🔍 Найдено ${questionBlocks.length} блоков вопросов`);
            return 'questions';
        }
        
        // 3. Текстовые поля с именами task_ (вопросы)
        const taskTextareas = document.querySelectorAll('textarea[name*="task"]');
        if (taskTextareas.length > 0) {
            console.log(`🔍 Найдено ${taskTextareas.length} полей для ответов`);
            return 'questions';
        }
        
        // 4. Описание "Для отклика необходимо ответить на несколько вопросов"
        const descriptionElements = document.querySelectorAll('[data-qa="title-description"]');
        for (const el of descriptionElements) {
            if (el.textContent.includes('ответить на несколько вопросов')) {
                console.log('🔍 Найдено описание с вопросами');
                return 'questions';
            }
        }

        // ===== ПРОВЕРКА НА МОДАЛЬНОЕ ОКНО С ВОПРОСАМИ =====
        const modalSelectors = [
            '[role="dialog"]',
            '.magritte-modal-content-wrapper___23XFT',
            '[class*="modal"]',
            '[data-qa="vacancy-response-modal"]'
        ];
        
        for (const selector of modalSelectors) {
            const modal = document.querySelector(selector);
            if (modal) {
                // Проверяем, есть ли вопросы внутри модалки
                const modalQuestions = modal.querySelectorAll('[data-qa="task-body"]');
                if (modalQuestions.length > 0) {
                    console.log(`🔍 Найдено ${modalQuestions.length} вопросов в модалке`);
                    return 'questions';
                }
            }
        }

        // ===== ПРОВЕРКА НА ОБЫЧНЫЙ ОТКЛИК =====
        
        // Поле для сопроводительного письма
        const letterField = document.querySelector(
            '[data-qa*="letter"], ' +
            'textarea[name="letter"], ' +
            '[data-qa="vacancy-response-popup-form-letter-input"]'
        );
        
        if (letterField) {
            return 'normal';
        }
        
        // Кнопка отклика на странице
        const responseButton = document.querySelector('[data-qa="vacancy-response-link-top"]');
        if (responseButton) {
            return 'normal';
        }

        // По умолчанию
        return 'normal';
    });

    console.log(`📊 Тип страницы: ${pageType}`);
    return pageType;
}

/* ======================================================
   ПАРСИНГ ВОПРОСОВ (УЛУЧШЕННАЯ ВЕРСИЯ)
   ====================================================== */

/**
 * РАСШИРЕННОЕ определение типа вопроса с множественными стратегиями
 */
async function detectQuestionType(block) {
    // ========== СТРАТЕГИЯ 1: ПРОВЕРКА RADIO ==========
    // Ищем radio разными способами
    const radioSelectors = [
        'input[type="radio"]',
        '.magritte-radio-input___-IM3Y',  // Класс из твоего HTML
        '[data-qa="radio"]',
        '.radio',
        '[role="radio"]'
    ];
    
    for (const selector of radioSelectors) {
        const radioButtons = await block.$$(selector);
        if (radioButtons.length > 0) {
            // Собираем тексты вариантов
            const options = [];
            for (const radio of radioButtons) {
                // Пытаемся найти текст варианта разными способами
                const label = await radio.evaluate(el => {
                    // Способ 1: родительский label
                    const parentLabel = el.closest('label');
                    if (parentLabel) {
                        // Убираем текст самого radio из label
                        const radioClone = parentLabel.querySelector('input[type="radio"], .magritte-radio-input');
                        if (radioClone) {
                            const cloneText = radioClone.textContent || '';
                            return parentLabel.textContent?.replace(cloneText, '').trim() || '';
                        }
                        return parentLabel.textContent?.trim() || '';
                    }
                    
                    // Способ 2: следующий текстовый узел
                    const nextSibling = el.nextSibling;
                    if (nextSibling && nextSibling.nodeType === 3) {
                        return nextSibling.textContent?.trim() || '';
                    }
                    
                    // Способ 3: следующий элемент
                    const nextElement = el.nextElementSibling;
                    if (nextElement) {
                        return nextElement.textContent?.trim() || '';
                    }
                    
                    // Способ 4: ищем текст в контейнере data-qa="cell-text-content"
                    const cellText = el.closest('[data-qa="cell"]')?.querySelector('[data-qa="cell-text-content"]');
                    if (cellText) {
                        return cellText.textContent?.trim() || '';
                    }
                    
                    return '';
                });
                
                if (label && label.length > 0) {
                    options.push(label);
                }
            }
            
            // Если нашли варианты, возвращаем radio
            if (options.length > 0) {
                return { 
                    type: 'radio', 
                    count: radioButtons.length,
                    elements: radioButtons,
                    options 
                };
            }
        }
    }
    
    // ========== СТРАТЕГИЯ 2: ПРОВЕРКА TEXTAREA ==========
    // Проверяем видимые textarea
    const textareaSelectors = [
        'textarea:not([style*="display: none"])',
        'textarea:not([style*="hidden"])',
        'textarea:visible',
        '[data-qa="textarea-wrapper"] textarea',
        '.magritte-textarea___ugvor textarea'
    ];
    
    for (const selector of textareaSelectors) {
        const visibleTextarea = await block.$(selector);
        if (visibleTextarea) {
            const isVisible = await visibleTextarea.isVisible().catch(() => true);
            if (isVisible) {
                return { type: 'textarea', element: visibleTextarea };
            }
        }
    }
    
    // ========== СТРАТЕГИЯ 3: СКРЫТЫЕ TEXTAREA ==========
    // Проверяем скрытые textarea (для "Свой вариант")
    const hiddenTextarea = await block.$('textarea');
    if (hiddenTextarea) {
        return { type: 'hidden_textarea', element: hiddenTextarea };
    }
    
    // ========== СТРАТЕГИЯ 4: ПРОВЕРКА INPUT ==========
    // Проверяем input поля (редко, но бывает)
    const inputField = await block.$('input[type="text"], input:not([type])');
    if (inputField) {
        const isVisible = await inputField.isVisible().catch(() => true);
        if (isVisible) {
            return { type: 'textarea', element: inputField };
        }
    }
    
    // ========== СТРАТЕГИЯ 5: ПОИСК ПО КЛАССАМ ==========
    // Ищем по специфичным классам HH
    const classSelectors = [
        '.task-option-text textarea',
        '.magritte-textarea___ugvor textarea',
        '[data-qa="textarea-native-wrapper"] textarea'
    ];
    
    for (const selector of classSelectors) {
        const textarea = await block.$(selector);
        if (textarea) {
            const isVisible = await textarea.isVisible().catch(() => true);
            if (isVisible) {
                return { type: 'textarea', element: textarea };
            }
            return { type: 'hidden_textarea', element: textarea };
        }
    }
    
    return { type: 'unknown' };
}

/**
 * Парсинг вопросов (УЛУЧШЕННАЯ ВЕРСИЯ)
 */
export async function parseQuestions(page) {
    const questions = [];
    
    // ========== СТРАТЕГИЯ 1: ПОИСК ПО DATA-QA ==========
    let questionBlocks = await page.$$('[data-qa="task-body"]');
    
    // ========== СТРАТЕГИЯ 2: ПОИСК ПО КОНТЕЙНЕРАМ ==========
    if (questionBlocks.length === 0) {
        const containerSelectors = [
            '.magritte-v-spacing-container',
            '.vacancy-response-question',
            '.bloko-form_question',
            '.question-block',
            'fieldset',
            '.magritte-card'
        ];
        
        for (const selector of containerSelectors) {
            const blocks = await page.$$(selector);
            if (blocks.length > 0) {
                // Фильтруем блоки, которые содержат radio или textarea
                for (const block of blocks) {
                    const hasRadio = await block.$('input[type="radio"]').catch(() => null);
                    const hasTextarea = await block.$('textarea').catch(() => null);
                    if (hasRadio || hasTextarea) {
                        questionBlocks.push(block);
                    }
                }
                if (questionBlocks.length > 0) break;
            }
        }
    }
    
    // ========== СТРАТЕГИЯ 3: ПОИСК ПО СТРУКТУРЕ ==========
    if (questionBlocks.length === 0) {
        // Ищем все блоки с radio и группируем их
        const radioGroups = new Map();
        const radios = await page.$$('input[type="radio"]');
        
        for (const radio of radios) {
            const name = await radio.evaluate(el => el.name);
            if (name) {
                if (!radioGroups.has(name)) {
                    radioGroups.set(name, []);
                }
                radioGroups.get(name).push(radio);
            }
        }
        
        // Для каждой группы radio находим родительский блок
        for (const [name, radioList] of radioGroups) {
            if (radioList.length > 0) {
                const parent = await radioList[0].evaluateHandle(el => 
                    el.closest('[data-qa="task-body"], .magritte-v-spacing-container, fieldset') || el.parentElement
                );
                if (!questionBlocks.some(block => block._guid === parent._guid)) {
                    questionBlocks.push(parent.asElement());
                }
            }
        }
    }
    
    console.log(`📋 Найдено ${questionBlocks.length} блоков вопросов`);
    
    // Обрабатываем каждый блок
    for (const block of questionBlocks) {
        // Получаем текст вопроса (множественные стратегии)
        let questionText = '';
        const questionSelectors = [
            '.g-user-content',
            '[data-qa="task-question"]',
            '.magritte-text_style-secondary',
            'p:first-of-type',
            '.bloko-text',
            '.question-text',
            'strong'
        ];
        
        for (const selector of questionSelectors) {
            try {
                const element = await block.$(selector);
                if (element) {
                    questionText = await element.evaluate(el => el.textContent?.trim() || '');
                    if (questionText && questionText.length > 10) break;
                }
            } catch (e) {}
        }
        
        // Если не нашли через селекторы, берем весь текст блока
        if (!questionText || questionText.length < 5) {
            questionText = await block.evaluate(el => {
                // Убираем текст из radio вариантов
                const radioTexts = Array.from(el.querySelectorAll('label, [data-qa="cell-text-content"]'))
                    .map(l => l.textContent?.trim() || '');
                
                let fullText = el.textContent?.trim() || '';
                // Вычитаем варианты ответов
                for (const rt of radioTexts) {
                    fullText = fullText.replace(rt, '');
                }
                return fullText.trim();
            });
        }
        
        // Определяем тип вопроса
        const questionType = await detectQuestionType(block);
        
        questions.push({
            block,
            questionText,
            type: questionType.type,
            radioCount: questionType.type === 'radio' ? questionType.count : 0,
            radioElements: questionType.type === 'radio' ? questionType.elements : [],
            options: questionType.type === 'radio' ? questionType.options : [],
            textarea: (questionType.type === 'textarea' || questionType.type === 'hidden_textarea') ? questionType.element : null,
            answered: false
        });
    }
    
    console.log(`📋 Распарсено ${questions.length} вопросов`);
    
    // Выводим типы вопросов для отладки
    questions.forEach((q, i) => {
        console.log(`   Вопрос ${i+1}: тип ${q.type}${q.type === 'radio' ? ` (${q.options.length} вариантов)` : ''}`);
    });
    
    return questions;
}

/* ======================================================
   ЗАПОЛНЕНИЕ ОТВЕТОВ (УЛУЧШЕННАЯ ВЕРСИЯ)
   ====================================================== */

/**
 * Определение правильного индекса для radio вопроса
 */
function determineRadioIndex(questionText, options) {
    const lowerQuestion = questionText.toLowerCase();
    const lowerOptions = options.map(opt => opt.toLowerCase());
    
    // Приоритетные ключевые слова для каждого типа вопроса
    const questionRules = [
        {
            keywords: ['компонент', 'список объектов', 'карточек'],
            preferredKeywords: ['уникальные ключи', 'key'],
            defaultIndex: 0
        },
        {
            keywords: ['форма', 'задержки', 'рендеринг', 'ввод'],
            preferredKeywords: ['debounce', 'ограничения частоты'],
            defaultIndex: 2
        },
        {
            keywords: ['пересчитываются', 'ненужные рендеры', 'пропсы'],
            preferredKeywords: ['все вышеперечисленное', 'react.memo', 'purecomponent'],
            defaultIndex: 3
        },
        {
            keywords: ['таблицу', 'множеством данных', 'строк'],
            preferredKeywords: ['виртуализацию', 'react-window', 'react-virtualized'],
            defaultIndex: 1
        },
        {
            keywords: ['формат работы'],
            preferredKeywords: ['удаленный', 'remote'],
            defaultIndex: 2
        }
    ];
    
    // Ищем подходящее правило
    for (const rule of questionRules) {
        if (rule.keywords.some(kw => lowerQuestion.includes(kw))) {
            // Ищем предпочтительный вариант в опциях
            for (const keyword of rule.preferredKeywords) {
                const index = lowerOptions.findIndex(opt => opt.includes(keyword));
                if (index !== -1) {
                    return index;
                }
            }
            // Если не нашли, возвращаем индекс по умолчанию
            return rule.defaultIndex;
        }
    }
    
    return 0; // По умолчанию первый вариант
}

/**
 * Заполнение ответов на вопросы
 */
export async function fillAnswers(page, questions, resumeText, vacancyData) {
    console.log(`\n📝 Заполнение ответов...`);
    
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        console.log(`\n   Вопрос ${i + 1}/${questions.length}: ${q.questionText.substring(0, 60)}...`);
        console.log(`   Тип: ${q.type}`);
        
        // Вопрос с радио-кнопками
        if (q.type === 'radio') {
            console.log(`   🔘 Варианты ответов (${q.options.length}):`);
            q.options.forEach((opt, idx) => {
                if (opt && opt.length > 0) {
                    console.log(`      ${idx + 1}. ${opt.substring(0, 50)}...`);
                }
            });
            
            // Определяем правильный индекс
            let selectedIndex = determineRadioIndex(q.questionText, q.options);
            
            // Пробуем использовать AI для выбора
            if (process.env.OPENROUTER_API_KEY && q.options.length > 0) {
                try {
                    const aiChoice = await generateAnswer(q.questionText, resumeText, vacancyData, {
                        includeOptions: true,
                        optionsList: q.options.filter(opt => opt && opt.length > 0)
                    });
                    const aiIndex = parseInt(aiChoice) - 1;
                    if (aiIndex >= 0 && aiIndex < q.options.length) {
                        selectedIndex = aiIndex;
                        console.log(`   🤖 AI выбрал вариант ${aiIndex + 1}`);
                    }
                } catch (e) {
                    console.log(`   ⚠️ AI не помог с выбором, использую логику`);
                }
            }
            
            // Кликаем по выбранной радио-кнопке
            if (q.radioElements && q.radioElements.length > selectedIndex) {
                try {
                    // Пробуем разные способы клика
                    const radioToClick = q.radioElements[selectedIndex];
                    
                    // Способ 1: force click
                    await radioToClick.click({ force: true, timeout: 30000 });
                    
                    // Способ 2: если не сработало, пробуем клик по родительскому label
                    const parentLabel = await radioToClick.evaluateHandle(el => el.closest('label'));
                    if (parentLabel) {
                        await parentLabel.asElement()?.click({ force: true }).catch(() => {});
                    }
                    
                    console.log(`   ✅ Выбран вариант ${selectedIndex + 1}: ${q.options[selectedIndex]?.substring(0, 50)}...`);
                    
                    // Ждем возможного появления текстового поля
                    await page.waitForTimeout(1500);
                    
                    // Проверяем, не появилось ли текстовое поле после выбора
                    const customTextarea = await q.block.$('textarea:not([style*="display: none"])');
                    if (customTextarea && await customTextarea.isVisible().catch(() => false)) {
                        console.log(`   ✍️ Появилось поле для ввода (свой вариант)`);
                        const answer = await generateAnswer(q.questionText, resumeText, vacancyData);
                        await typeTextSafely(page, customTextarea, answer);
                    }
                } catch (error) {
                    console.log(`   ⚠️ Ошибка при клике: ${error.message}`);
                    
                    // Финальный способ через evaluate
                    try {
                        await page.evaluate((el) => {
                            el.click();
                            el.checked = true;
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            
                            // Также пробуем кликнуть по родителю
                            const parent = el.closest('label, [data-qa="cell"]');
                            if (parent) parent.click();
                        }, q.radioElements[selectedIndex]);
                        console.log(`   ✅ Выбран вариант через evaluate`);
                    } catch (e) {
                        console.log(`   ❌ Не удалось выбрать вариант`);
                    }
                }
            } else {
                console.log(`   ⚠️ Не удалось выбрать вариант, кликаем первый`);
                if (q.radioElements && q.radioElements[0]) {
                    await q.radioElements[0].click({ force: true }).catch(() => {});
                }
            }
        }
        
        // Вопрос с текстовым полем
        else if (q.type === 'textarea' && q.textarea) {
            console.log(`   ✍️ Генерация ответа...`);
            const answer = await generateAnswer(q.questionText, resumeText, vacancyData);
            console.log(`   📝 Ответ: ${answer.substring(0, 60)}...`);
            
            const success = await typeTextSafely(page, q.textarea, answer);
            if (success) {
                console.log(`   ✅ Ответ введен`);
            } else {
                console.log(`   ⚠️ Не удалось ввести ответ`);
            }
        }
        
        // Скрытое текстовое поле
        else if (q.type === 'hidden_textarea') {
            console.log(`   ⏭️  Скрытое поле (появится после выбора "Свой вариант")`);
        }
        
        else {
            console.log(`   ⚠️ Неизвестный тип вопроса`);
        }
        
        q.answered = true;
        await page.waitForTimeout(1500);
    }
    
    console.log(`\n✅ Все вопросы обработаны`);
}

/* ======================================================
   ОСНОВНАЯ ФУНКЦИЯ ДЛЯ ОТВЕТОВ
   ====================================================== */

/**
 * Основная функция для ответов на вопросы
 */
export async function answerQuestions(page, resumeText, vacancyData) {
    console.log('📋 Начинаем обработку вопросов...');
    
    // Небольшая задержка для загрузки DOM
    await page.waitForTimeout(2000);
    
    // Парсим вопросы
    const questions = await parseQuestions(page);
    
    if (questions.length === 0) {
        console.log('⚠️ Вопросы не найдены');
        return false;
    }
    
    // Заполняем ответы
    await fillAnswers(page, questions, resumeText, vacancyData);
    
    // Ждем немного перед отправкой
    await page.waitForTimeout(3000);
    
    // Ищем кнопку отправки (расширенный список)
    const submitSelectors = [
        'button[type="submit"][data-qa="vacancy-response-submit-popup"]',
        'button[type="submit"]',
        '[data-qa="submit"]',
        '[data-qa="response-submit"]',
        '[data-qa="vacancy-response-submit"]',
        'button:has-text("Откликнуться")',
        'button:has-text("Отправить")',
        'button:has-text("Ответить")',
        'button:has-text("Submit")',
        'button:has-text("Send")',
        '.magritte-button_mode-primary[type="submit"]',
        '.buttons--A5C8jEmU5R8_tpQE button'
    ];
    
    for (const selector of submitSelectors) {
        try {
            const submitBtn = await page.$(selector);
            if (submitBtn) {
                const isVisible = await submitBtn.isVisible().catch(() => true);
                if (isVisible) {
                    await submitBtn.click();
                    console.log('📤 Ответы отправлены');
                    return true;
                }
            }
        } catch (e) {}
    }
    
    console.log('⚠️ Кнопка отправки не найдена');
    return false;
}