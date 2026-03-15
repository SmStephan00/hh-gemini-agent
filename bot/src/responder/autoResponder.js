import { generateCoverLetter } from '../gemini/letterGenerator.js';
import { parseVacancyPage } from '../parser/vacancyParser.js';

// 🔥 ДОБАВЛЕНО: Вспомогательные функции для повторных попыток
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

// 🔥 ДОБАВЛЕНО: Нормализация URL (замена karakan.hh.ru на hh.ru)
function normalizeUrl(url) {
    if (!url) return url;
    return url.replace('karakan.hh.ru', 'hh.ru');
}

/**
 * Автоматический отклик на вакансию
 */
export async function autoRespond(page, vacancyUrl, resumeText, userPrompt = '', options = {}) {
    try {
        // 🔥 ДОБАВЛЕНО: Нормализуем URL перед использованием
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
        
        // 🔥 ИЗМЕНЕНО: Переходим на страницу вакансии с повторными попытками
        await withRetry(async () => {
            await page.goto(normalizedUrl, { 
                waitUntil: 'networkidle', 
                timeout: 60000
            });
        }, 3, 5000);
        
        // 🔥 ИЗМЕНЕНО: Парсим данные вакансии с повторными попытками
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
        
        // 🔥 ИЗМЕНЕНО: Ищем кнопку отклика с повторными попытками
        let responseButton = await withRetry(async () => {
            // Сначала пробуем основной селектор
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
        
        // 🔥 ДОБАВЛЕНО: Шаблонное письмо
        const getTemplateLetter = (vacancy) => {
            return `Здравствуйте! Меня заинтересовала вакансия ${vacancy.title} в компании ${vacancy.company}. Мой опыт и навыки соответствуют вашим требованиям. Буду рад обсудить детали на собеседовании.`;
        };
        
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
        
        // 🔥 ИЗМЕНЕНО: Кликаем по кнопке отклика с повторными попытками
        await withRetry(async () => {
            await responseButton.click();
            await page.waitForTimeout(1000);
        }, 3, 2000);
        
        console.log('✅ Кнопка нажата, ждём модальное окно...');
        await page.waitForTimeout(3000);
        
        // 🔥 ИЗМЕНЕНО: Ищем поле для письма с повторными попытками
        let letterField = await withRetry(async () => {
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
                    console.log(`✅ Найдено поле для письма: ${selector}`);
                    return element;
                }
            }
            
            // Если не нашли, но это не критично - возвращаем null
            console.log('⚠️ Поле для письма не найдено');
            return null;
        }, 2, 1000);
        
        if (letterField) {
            try {
                // 🔥 ИЗМЕНЕНО: Ввод текста с повторными попытками
                await withRetry(async () => {
                    // Очищаем поле
                    await letterField.click({ clickCount: 3 });
                    await page.keyboard.press('Backspace');
                    await page.waitForTimeout(500);
                    
                    // Вводим текст
                    await letterField.type(coverLetter, { delay: 30 });
                    console.log('✍️ Письмо введено');
                }, 3, 1000);
                
            } catch (error) {
                console.log('⚠️ Ошибка при вводе письма:', error.message);
            }
        }
        
        // 🔥 ИЗМЕНЕНО: Ищем кнопку отправки с повторными попытками
        let submitButton = await withRetry(async () => {
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
                '[class*="submit"]:is(button, input)'
            ];
            
            for (const selector of submitSelectors) {
                const element = await page.$(selector);
                if (element && await element.isVisible()) {
                    console.log(`✅ Найдена кнопка отправки: ${selector}`);
                    return element;
                }
            }
            
            throw new Error('Кнопка отправки не найдена');
        }, 3, 2000);
        
        // 🔥 ИЗМЕНЕНО: Отправляем отклик с повторными попытками
        await withRetry(async () => {
            await submitButton.click();
            console.log('📤 Отправляем отклик...');
            await page.waitForTimeout(3000);
        }, 3, 2000);
        
        // 🔥 ИЗМЕНЕНО: Проверяем успешность с повторными попытками
        const success = await withRetry(async () => {
            const successSelectors = [
                '[data-qa="response-success-message"]',
                '[data-qa="response-success"]',
                '[data-qa="vacancy-response-success"]',
                'div:has-text("Отклик отправлен")',
                'div:has-text("Вы успешно откликнулись")',
                '.vacancy-response-success',
                '[class*="success"]:has-text("отправлен")'
            ];
            
            for (const selector of successSelectors) {
                const element = await page.$(selector);
                if (element) {
                    console.log(`✅ Найден признак успеха: ${selector}`);
                    return true;
                }
            }
            
            // Проверяем, не появилось ли модальное окно с ошибкой
            const errorModal = await page.$('[data-qa="vacancy-response-error"]');
            if (errorModal) {
                console.log('⚠️ Обнаружена ошибка при отклике');
                return false;
            }
            
            throw new Error('Не удалось подтвердить отправку');
        }, 5, 2000);
        
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