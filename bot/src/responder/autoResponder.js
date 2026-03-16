import { generateCoverLetter } from '../gemini/letterGenerator.js';
import { parseVacancyPage } from '../parser/vacancyParser.js';

/**
 * Шаблонное письмо (вынесено в начало)
 */
function getTemplateLetter(vacancy) {
    return `Здравствуйте! Меня заинтересовала вакансия ${vacancy.title} в компании ${vacancy.company}. Мой опыт и навыки соответствуют вашим требованиям. Буду рад обсудить детали на собеседовании.`;
}

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
 * 🔥 УЛУЧШЕННАЯ ПРОВЕРКА УСПЕХА ОТПРАВКИ
 * Решает проблему №1: Не удалось подтвердить отправку
 */
async function checkSuccessWithRetry(page) {
    console.log('   🔍 Проверка подтверждения отправки...');
    
    const successPatterns = [
        // Селекторы data-qa
        { selector: '[data-qa="response-success-message"]', text: null },
        { selector: '[data-qa="response-success"]', text: null },
        { selector: '[data-qa="vacancy-response-success"]', text: null },
        { selector: '[data-qa="vacancy-response-success-message"]', text: null },
        
        // По тексту (русский)
        { selector: 'div', text: 'Отклик отправлен' },
        { selector: 'div', text: 'Резюме доставлено' },
        { selector: 'div', text: 'Вы успешно откликнулись' },
        { selector: 'div', text: 'Ваш отклик отправлен' },
        { selector: 'div', text: 'Отклик принят' },
        { selector: 'p', text: 'Отклик отправлен' },
        { selector: 'span', text: 'Отклик отправлен' },
        
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
        { selector: 'div[class*="modal"] div:has-text("отправлен")', text: null }
    ];

    // Увеличиваем количество попыток до 15 и общее время до 30 секунд
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

/**
 * 🔥 УЛУЧШЕННЫЙ ВВОД ТЕКСТА (быстрый и надежный)
 * Решает проблему №2: Таймаут при вводе письма
 */
async function typeTextSafely(page, selector, text) {
    console.log(`   ⌨️ Ввод текста в: ${selector}`);
    
    return await withRetry(async () => {
        // 🔥 Ищем элемент ЗАНОВО на каждой попытке (решает проблему №3)
        const freshElement = await page.$(selector);
        if (!freshElement) {
            throw new Error('Элемент не найден в DOM');
        }

        // 🔥 Пробуем быстрый способ через evaluate (для contenteditable div)
        const evaluateSuccess = await page.evaluate((sel, txt) => {
            const element = document.querySelector(sel);
            if (!element) return false;

            // Если это contenteditable div
            if (element.isContentEditable) {
                element.textContent = txt;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            } 
            // Если это обычный input или textarea
            else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.value = txt;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
            return false;
        }, selector, text);

        if (evaluateSuccess) {
            console.log('   ✅ Текст вставлен через evaluate (быстро)');
            return;
        }

        // 🔥 Запасной способ через type (медленно, но надежно)
        console.log('   ⚠️ evaluate не сработал, пробуем type...');
        await freshElement.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(500);
        await freshElement.type(text, { delay: 20 });
        console.log('   ✅ Текст введён через type');
        
    }, 3, 2000);
}

/**
 * Автоматический отклик на вакансию
 */
export async function autoRespond(page, vacancyUrl, resumeText, userPrompt = '', options = {}) {
    const startTime = Date.now();
    
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
        
        // Переходим на страницу вакансии с повторными попытками
        await withRetry(async () => {
            await page.goto(normalizedUrl, { 
                waitUntil: 'networkidle', 
                timeout: 60000
            });
        }, 3, 5000);
        
        // Парсим данные вакансии с повторными попытками
        const vacancyData = await withRetry(async () => {
            return await parseVacancyPage(page);
        }, 3, 3000);
        
        console.log(`📋 Вакансия: ${vacancyData.title} в ${vacancyData.company}`);
        
        // Проверяем, не откликались ли уже
        const alreadyResponded = await page.$('[data-qa="vacancy-response-success-message"]');
        if (alreadyResponded) {
            console.log('⚠️ Уже откликались на эту вакансию');
            return { success: false, reason: 'already_responded' };
        }
        
        // Ищем кнопку отклика с повторными попытками
        let responseButton = await withRetry(async () => {
            let button = await page.$('[data-qa="vacancy-response-button"]');
            
            if (!button) {
                console.log('🔍 Ищем альтернативные селекторы...');
                
                const buttonSelectors = [
                    '[data-qa="vacancy-response-button-top"]',
                    '[data-qa="vacancy-response-button-side"]',
                    '[data-qa="vacancy-response-button-desktop"]',
                    '[data-qa="vacancy-response-button-mobile"]',
                    '[data-qa="response-button"]',
                    'a:has-text("Откликнуться")',
                    'button:has-text("Откликнуться")',
                    'button:has-text("Apply")',
                    '[class*="response-button"]',
                    '[class*="apply-button"]'
                ];
                
                for (const selector of buttonSelectors) {
                    button = await page.$(selector);
                    if (button) {
                        console.log(`✅ Найдена кнопка по селектору: ${selector}`);
                        break;
                    }
                }
            }
            
            if (!button) throw new Error('Кнопка отклика не найдена');
            return button;
        }, 3, 2000);
        
        // Генерируем сопроводительное письмо
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
        
        // 🔥 ИЗМЕНЕНО: Кликаем по кнопке отклика с повторными попытками и перепоиском
        await withRetry(async () => {
            // 🔥 Ищем элемент заново перед кликом (решает проблему №3)
            const freshButton = await page.$('[data-qa*="response-button"], a:has-text("Откликнуться"), button:has-text("Откликнуться")');
            if (!freshButton) throw new Error('Кнопка отклика исчезла из DOM');
            await freshButton.click();
            await page.waitForTimeout(1000);
        }, 3, 2000);
        
        console.log('✅ Кнопка нажата, ждём модальное окно...');
        await page.waitForTimeout(3000);
        
        // Сохраняем скриншот для отладки
        await page.screenshot({ path: `debug-form-${Date.now()}.png` });
        
        // Ищем поле для письма
        let letterSelector = null;
        const letterSelectors = [
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
        
        for (const selector of letterSelectors) {
            const element = await page.$(selector);
            if (element && await element.isVisible()) {
                letterSelector = selector;
                console.log(`✅ Найдено поле для письма: ${selector}`);
                break;
            }
        }
        
        if (letterSelector) {
            // 🔥 ИСПОЛЬЗУЕМ УЛУЧШЕННЫЙ ВВОД ТЕКСТА
            await typeTextSafely(page, letterSelector, coverLetter);
        } else {
            console.log('⚠️ Поле для письма не найдено');
        }
        
        // Ищем кнопку отправки
        let submitSelector = null;
        const submitSelectors = [
            '[data-qa="response-submit"]',
            '[data-qa="response-submit-button"]',
            '[data-qa="submit-response"]',
            '[data-qa="apply-submit"]',
            'button[type="submit"]',
            'button:has-text("Отправить")',
            'button:has-text("Откликнуться")',
            'button:has-text("Submit")',
            'button:has-text("Apply")',
            'input[type="submit"]',
            'button[data-qa="submit"]',
            '[data-qa="vacancy-response-submit-popup"]',
            '[class*="submit"]:is(button, input)'
        ];
        
        for (const selector of submitSelectors) {
            const element = await page.$(selector);
            if (element && await element.isVisible()) {
                submitSelector = selector;
                console.log(`✅ Найдена кнопка отправки: ${selector}`);
                break;
            }
        }
        
        if (!submitSelector) {
            console.log('⚠️ Кнопка отправки не найдена');
            await page.screenshot({ path: 'debug-no-submit.png' });
            return { success: false, reason: 'no_submit_button' };
        }
        
        // 🔥 ИЗМЕНЕНО: Отправляем отклик с повторными попытками и перепоиском
        await withRetry(async () => {
            // 🔥 Ищем элемент заново перед кликом (решает проблему №3)
            const freshButton = await page.$(submitSelector);
            if (!freshButton) throw new Error('Кнопка отправки исчезла из DOM');
            await freshButton.click();
            await page.waitForTimeout(1000);
        }, 3, 2000);
        
        console.log('📤 Отправляем отклик...');
        
        // 🔥 ИСПОЛЬЗУЕМ УЛУЧШЕННУЮ ПРОВЕРКУ УСПЕХА
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
            
            const duration = (Date.now() - startTime) / 1000;
            console.log(`⏱️  Время выполнения: ${duration.toFixed(1)} сек`);
            
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
            'button:has-text("Отмена")',
            'button:has-text("Cancel")'
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
        
        // Пробуем нажать Escape
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

/**
 * Пакетный отклик на несколько вакансий
 */
export async function batchRespond(page, vacancies, resumeText, userPrompt = '', options = {}) {
    const {
        delay = 30000,
        randomDelay = true,
        maxResponses = 80,
        ...otherOptions
    } = options;
    
    console.log(`\n🚀 ЗАПУСК ПАКЕТНОГО ОТКЛИКА`);
    console.log(`📊 Всего вакансий: ${vacancies.length}`);
    console.log(`⏱️  Задержка: ${delay/1000} сек ${randomDelay ? '(рандомная)' : ''}`);
    
    const results = {
        total: vacancies.length,
        success: 0,
        failed: 0,
        skipped: 0,
        details: []
    };
    
    for (let i = 0; i < vacancies.length; i++) {
        if (results.success >= maxResponses) {
            console.log(`\n⚠️ Достигнут лимит откликов (${maxResponses})`);
            break;
        }
        
        const vacancy = vacancies[i];
        console.log(`\n--- [${i+1}/${vacancies.length}] ${vacancy.title} ---`);
        
        const result = await autoRespond(page, vacancy.url, resumeText, userPrompt, otherOptions);
        
        if (result.success) {
            results.success++;
            if (result.data) results.details.push(result.data);
        } else {
            results.failed++;
        }
        
        // Пауза между откликами
        if (i < vacancies.length - 1 && results.success < maxResponses) {
            let pauseTime = delay;
            if (randomDelay) {
                pauseTime = delay + Math.random() * 60000;
            }
            console.log(`⏳ Пауза ${Math.round(pauseTime/1000)} сек...`);
            await new Promise(resolve => setTimeout(resolve, pauseTime));
        }
    }
    
    results.skipped = vacancies.length - results.success - results.failed;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 ИТОГИ ОТКЛИКОВ');
    console.log('='.repeat(50));
    console.log(`✅ Успешно: ${results.success}`);
    console.log(`❌ Ошибок: ${results.failed}`);
    console.log(`⏭️  Пропущено: ${results.skipped}`);
    console.log('='.repeat(50));
    
    return results;
}