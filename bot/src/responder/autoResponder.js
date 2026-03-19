// src/responder/autoRespond.js
import { generateCoverLetter } from '../gemini/letterGenerator.js';
import { parseVacancyPage } from '../parser/vacancyParser.js';
import { detectPageType, answerQuestions } from './questionHandler.js';

/* ======================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ====================================================== */

/**
 * Вспомогательная функция для повторных попыток
 */
async function withRetry(fn, maxAttempts = 3, delay = 2000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            console.log(`   ⚠️ Попытка ${attempt}/${maxAttempts} не удалась: ${error.message}`);
            if (attempt === maxAttempts) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
    }
}

/**
 * Нормализация URL (замена karakan.hh.ru на hh.ru)
 */
function normalizeUrl(url) {
    if (!url) return url;
    return url.replace('karakan.hh.ru', 'hh.ru');
}

/**
 * Шаблонное письмо
 */
function getTemplateLetter(vacancy) {
    return `Здравствуйте! Меня заинтересовала вакансия ${vacancy.title} в компании ${vacancy.company}. Мой опыт и навыки соответствуют вашим требованиям. Буду рад обсудить детали на собеседовании.`;
}

/* ======================================================
   ПРОВЕРКА УСПЕХА ОТПРАВКИ
   ====================================================== */

/**
 * УЛУЧШЕННАЯ ПРОВЕРКА УСПЕХА ОТПРАВКИ
 */
async function checkSuccessWithRetry(page) {
    console.log('   🔍 Проверка подтверждения отправки...');
    
    const successPatterns = [
        // Селекторы data-qa
        { selector: '[data-qa="response-success-message"]', text: null },
        { selector: '[data-qa="response-success"]', text: null },
        { selector: '[data-qa="vacancy-response-success"]', text: null },
        { selector: '[data-qa="vacancy-response-success-message"]', text: null },
        
        // Селекторы для блока "Резюме доставлено"
        { selector: 'div:has-text("Резюме доставлено")', text: null },
        { selector: '[data-qa="vacancy-response-link-view-topic"]', text: null },
        
        // По тексту (русский)
        { selector: 'div', text: 'Резюме доставлено' },
        { selector: 'div', text: 'Отклик отправлен' },
        { selector: 'div', text: 'Вы успешно откликнулись' },
        { selector: 'div', text: 'Ваш отклик отправлен' },
        { selector: 'div', text: 'Отклик принят' },
        
        // По классам
        { selector: '.vacancy-response-success', text: null },
        { selector: '.response-success', text: null },
        { selector: '.bloko-text:has-text("отправлен")', text: null },
        { selector: '[class*="success"]', text: 'отправлен' },
        { selector: '[class*="success"]', text: 'success' },
        
        // По атрибутам
        { selector: '[aria-label*="успешно"]', text: null },
        { selector: '[data-state="success"]', text: null },
        { selector: '[data-status="success"]', text: null },
        
        // В модалке
        { selector: 'div[role="dialog"] div:has-text("отправлен")', text: null },
        { selector: 'div[class*="modal"] div:has-text("отправлен")', text: null },
        
        // Специально для блока "Резюме доставлено"
        { selector: '.magritte-card___bhGKz_8-3-7 div:has-text("Резюме доставлено")', text: null }
    ];

    const maxAttempts = 15;
    const delayBetween = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        for (const pattern of successPatterns) {
            try {
                if (pattern.text) {
                    // Поиск по тексту
                    const element = await page.getByText(pattern.text, { exact: false }).first();
                    if (await element?.isVisible()) {
                        console.log(`   ✅ Найдено подтверждение по тексту: "${pattern.text}" (попытка ${attempt + 1})`);
                        return true;
                    }
                } else {
                    // Поиск по селектору
                    const element = await page.$(pattern.selector);
                    if (element && await element.isVisible()) {
                        console.log(`   ✅ Найдено подтверждение по селектору: ${pattern.selector} (попытка ${attempt + 1})`);
                        return true;
                    }
                }
            } catch (e) {
                // Игнорируем ошибки при проверке
            }
        }
        
        if (attempt < maxAttempts - 1) {
            console.log(`   ⏳ Попытка ${attempt + 1}/${maxAttempts} не дала результата, ждём...`);
            await page.waitForTimeout(delayBetween);
        }
    }

    console.log('   ⚠️ Не удалось найти подтверждение отправки');
    await page.screenshot({ path: `debug-success-fail-${Date.now()}.png`, fullPage: true });
    return false;
}

/* ======================================================
   ФУНКЦИИ ПОИСКА ЭЛЕМЕНТОВ
   ====================================================== */

/**
 * Поиск кнопки отклика
 */
async function findResponseButton(page) {
    // Приоритетные селекторы (новые и самые надежные)
    const prioritySelectors = [
        '[data-qa="vacancy-response-link-top"]',  // Из твоего HTML
        '[data-qa="vacancy-response-button"]',
        'a:has-text("Откликнуться")',
        'button:has-text("Откликнуться")'
    ];
    
    for (const selector of prioritySelectors) {
        const button = await page.$(selector);
        if (button && await button.isVisible()) {
            console.log(`✅ Найдена кнопка по селектору: ${selector}`);
            return button;
        }
    }
    
    // Альтернативные селекторы
    console.log('🔍 Ищем альтернативные селекторы...');
    const altSelectors = [
        '[data-qa="vacancy-response-button-top"]',
        '[data-qa="vacancy-response-button-side"]',
        '[data-qa="vacancy-response-button-desktop"]',
        '[data-qa="vacancy-response-button-mobile"]',
        '[data-qa="response-button"]',
        'button:has-text("Apply")',
        '[class*="response-button"]',
        '[class*="apply-button"]',
        '.vacancy-response-button'
    ];
    
    for (const selector of altSelectors) {
        const button = await page.$(selector);
        if (button && await button.isVisible()) {
            console.log(`✅ Найдена кнопка по селектору: ${selector}`);
            return button;
        }
    }
    
    return null;
}

/**
 * Поиск поля для письма
 */
async function findLetterField(page) {
    const selectors = [
        '[data-qa="response-letter"]',
        '[data-qa="response-letter-input"]',
        '[data-qa="response-letter-textarea"]',
        '[data-qa="cover-letter"]',
        'textarea[name="letter"]',
        'textarea[name="message"]',
        'div[contenteditable="true"][data-qa*="letter"]',
        '[data-qa*="letter"]',
        'textarea'
    ];
    
    for (const selector of selectors) {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
            console.log(`✅ Найдено поле для письма: ${selector}`);
            return { element, selector };
        }
    }
    
    console.log('⚠️ Поле для письма не найдено');
    return { element: null, selector: null };
}

/**
 * Поиск кнопки отправки
 */
async function findSubmitButton(page) {
    const selectors = [
        '[data-qa="response-submit"]',
        '[data-qa="response-submit-button"]',
        '[data-qa="submit-response"]',
        '[data-qa="apply-submit"]',
        'button[type="submit"]',
        'button:has-text("Отправить")',
        'button:has-text("Откликнуться")',
        'button:has-text("Откликнуться без теста")',
        'button:has-text("Submit")',
        'button:has-text("Apply")',
        '[class*="submit"]:is(button, input)',
        '[data-qa="vacancy-response-submit-popup"]'
    ];
    
    for (const selector of selectors) {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
            console.log(`✅ Найдена кнопка отправки: ${selector}`);
            return element;
        }
    }
    
    return null;
}

/* ======================================================
   ОСНОВНАЯ ФУНКЦИЯ АВТОМАТИЧЕСКОГО ОТКЛИКА
   ====================================================== */

/**
 * Автоматический отклик на вакансию
 */
export async function autoRespond(page, vacancyUrl, resumeText, userPrompt = '', options = {}) {
    try {
        const normalizedUrl = normalizeUrl(vacancyUrl);
        if (normalizedUrl !== vacancyUrl) {
            console.log(`🔄 URL нормализован: ${vacancyUrl} -> ${normalizedUrl}`);
        }
        
        console.log(`\n📝 ОТКЛИК НА ВАКАНСИЮ: ${normalizedUrl}`);
        
        const {
            minScore = 0,
            useGemini = true,
            forceResponse = false,
            debug = false
        } = options;
        
        // 1. Переходим на страницу вакансии
        await withRetry(async () => {
            await page.goto(normalizedUrl, { 
                waitUntil: 'networkidle', 
                timeout: 60000
            });
        }, 3, 5000);
        
        // 2. Парсим данные вакансии
        const vacancyData = await withRetry(async () => {
            return await parseVacancyPage(page);
        }, 3, 3000);
        
        // 3. Проверяем тип страницы ДО нажатия кнопки (только для информации)
        const initialPageType = await detectPageType(page);
        console.log(`📊 Тип страницы (до нажатия): ${initialPageType}`);

        // 4. Обработка тестового задания
        if (initialPageType === 'test_task') {
            console.log('⏭️  Тестовое задание - пропускаем');
            return { success: false, reason: 'test_task', skipped: true };
        }

        // 5. ВАЖНО: НЕ обрабатываем вопросы на странице вакансии!
        // Даже если detectPageType ошибочно показал 'questions', мы все равно идем дальше
        // Потому что на странице вакансии вопросов быть не может по логике HH
        
        console.log(`📋 Вакансия: ${vacancyData.title} в ${vacancyData.company}`);
        
        // 6. Проверяем, не откликались ли уже
        const alreadyResponded = await page.$('[data-qa="vacancy-response-success-message"]');
        if (alreadyResponded) {
            console.log('⚠️ Уже откликались на эту вакансию');
            return { success: false, reason: 'already_responded' };
        }
        
        // 7. Ищем кнопку отклика
        let responseButton = await withRetry(async () => {
            const button = await findResponseButton(page);
            if (!button) throw new Error('Кнопка отклика не найдена');
            return button;
        }, 3, 2000);
        
        // 8. Генерируем сопроводительное письмо
        let coverLetter = '';
        
        if (useGemini) {
            try {
                console.log('🤖 Генерация сопроводительного письма...');
                coverLetter = await generateCoverLetter(vacancyData, resumeText, userPrompt);
                console.log(`📨 Письмо сгенерировано (${coverLetter.length} символов)`);
            } catch (error) {
                console.log('⚠️ Gemini не доступен, используем шаблон');
                coverLetter = getTemplateLetter(vacancyData);
            }
        } else {
            coverLetter = getTemplateLetter(vacancyData);
        }
        
        // 9. Кликаем по кнопке отклика
        await withRetry(async () => {
            await responseButton.click();
            await page.waitForTimeout(1000);
        }, 3, 2000);
        
        console.log('✅ Кнопка нажата, ждём модальное окно...');
        await page.waitForTimeout(3000);

        console.log('🔍 Анализ страницы...');

        async function debugPageContent(page) {
            const debug = await page.evaluate(() => {
                return {
                    hasQuestionsTitle: !!document.querySelector('[data-qa="employer-asking-for-test"]'),
                    taskBodyCount: document.querySelectorAll('[data-qa="task-body"]').length,
                    taskTextareas: document.querySelectorAll('textarea[name*="task"]').length,
                    hasLetterField: !!document.querySelector('[data-qa*="letter"], textarea[name="letter"]'),
                    url: window.location.href,
                    title: document.title
                };
            });
            console.log('🔍 Отладка страницы:', debug);
        }
        


        await debugPageContent(page);
        const afterClickPageType = await detectPageType(page);
        console.log(`📊 Тип страницы (после нажатия): ${afterClickPageType}`);
        
        // 11. Если открылись вопросы - отвечаем
        if (afterClickPageType === 'questions') {
            console.log('📋 После нажатия кнопки открылись вопросы - отвечаем...');
            const answered = await answerQuestions(page, resumeText, vacancyData);
            
            if (answered) {
                console.log('✅ Ответы на вопросы отправлены');
                const success = await checkSuccessWithRetry(page);
                return { success, data: vacancyData };
            } else {
                console.log('⚠️ Не удалось ответить на вопросы');
            }
        }
        
        // 12. Ищем поле для письма
        const { element: letterField, selector: letterSelector } = await findLetterField(page);
        
        if (letterField && letterSelector) {
            try {
                await withRetry(async () => {
                    // Ищем элемент заново перед каждым действием
                    const freshElement = await page.$(letterSelector);
                    if (!freshElement) throw new Error('Поле для письма исчезло');
                    
                    await freshElement.click({ clickCount: 3 });
                    await page.keyboard.press('Backspace');
                    await page.waitForTimeout(500);
                    await freshElement.type(coverLetter, { 
                        delay: 30,
                        timeout: 60000
                    });
                    console.log('✍️ Письмо введено');
                }, 3, 1000);
                
            } catch (error) {
                console.log('⚠️ Ошибка при вводе письма:', error.message);
            }
        }
        
        // 13. Ищем кнопку отправки
        const submitButton = await withRetry(async () => {
            const button = await findSubmitButton(page);
            if (!button) throw new Error('Кнопка отправки не найдена');
            return button;
        }, 3, 2000);
        
        // 14. Отправляем отклик
        await withRetry(async () => {
            await submitButton.click();
            console.log('📤 Отправляем отклик...');
            await page.waitForTimeout(3000);
        }, 3, 2000);
        
        // 15. Проверяем успех
        const success = await checkSuccessWithRetry(page);
        
        if (success) {
            console.log('✅ Отклик успешно отправлен!');
            
            const responseInfo = {
                title: vacancyData.title,
                company: vacancyData.company,
                url: normalizedUrl,
                timestamp: new Date().toISOString(),
                coverLetter: coverLetter ? coverLetter.substring(0, 100) + '...' : null
            };
            
            return { success: true, data: responseInfo };
            
        } else {
            console.log('⚠️ Не удалось подтвердить отправку');
            await page.screenshot({ path: `debug-no-confirmation-${Date.now()}.png` });
            return { success: false, reason: 'no_confirmation' };
        }
        
    } catch (error) {
        console.error('❌ Ошибка отклика:', error.message);
        await page.screenshot({ path: `debug-error-${Date.now()}.png` });
        return { success: false, reason: 'error', error: error.message };
    }
}

/* ======================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С ОКНАМИ
   ====================================================== */

/**
 * Закрытие модального окна
 */
export async function closeModal(page) {
    try {
        console.log('🔍 Ищем кнопку закрытия модального окна...');
        
        const closeButtonSelectors = [
            '[data-qa="modal-close"]',
            '[data-qa="dialog-close"]',
            '[data-qa="close-button"]',
            '[aria-label="Закрыть"]',
            '[aria-label="Close"]',
            '.modal-close',
            '.dialog-close',
            '.close-button',
            'button:has-text("×")',
            'button:has-text("Закрыть")',
            'button:has-text("Close")',
            'button:has-text("Отмена")'
        ];
        
        for (const selector of closeButtonSelectors) {
            try {
                const closeButton = await page.$(selector);
                if (closeButton && await closeButton.isVisible()) {
                    console.log(`✅ Найдена кнопка закрытия: ${selector}`);
                    await closeButton.click();
                    await page.waitForTimeout(1000);
                    return true;
                }
            } catch (e) {}
        }
        
        try {
            console.log('⌨️ Пробуем нажать Escape');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
            return true;
        } catch (e) {
            console.log('❌ Escape не сработал');
        }
        
        return false;
        
    } catch (error) {
        console.error('❌ Ошибка при закрытии модального окна:', error.message);
        return false;
    }
}

/* ======================================================
   ПАКЕТНЫЙ ОТКЛИК
   ====================================================== */

/**
 * Пакетный отклик на несколько вакансий
 */
