import { generateCoverLetter } from '../gemini/letterGenerator.js';
import { parseVacancyPage } from '../parser/vacancyParser.js';

/**
 * Автоматический отклик на вакансию
 */
export async function autoRespond(page, vacancyUrl, resumeText, userPrompt = '', options = {}) {
    try {
        console.log(`\n📝 ОТКЛИК НА ВАКАНСИЮ: ${vacancyUrl}`);
        
        const {
            minScore = 0,
            useGemini = true,
            forceResponse = false,
            debug = false
        } = options;
        
        // Переходим на страницу вакансии
        await page.goto(vacancyUrl, { waitUntil: 'networkidle' });
        
        // Парсим данные вакансии
        const vacancyData = await parseVacancyPage(page);
        console.log(`📋 Вакансия: ${vacancyData.title} в ${vacancyData.company}`);
        
        // Проверяем, не откликались ли уже
        const alreadyResponded = await page.$('[data-qa="vacancy-response-success-message"]');
        if (alreadyResponded) {
            console.log('⚠️ Уже откликались на эту вакансию');
            return { success: false, reason: 'already_responded' };
        }
        
        // Ищем кнопку отклика
        let responseButton = await page.$('[data-qa="vacancy-response-button"]');
        
        if (!responseButton) {
            console.log('🔍 Ищем альтернативные селекторы...');
            
            const buttonSelectors = [
                '[data-qa="vacancy-response-button"]',
                '[data-qa="vacancy-response-button-top"]',
                '[data-qa="vacancy-response-button-side"]',
                'a[data-qa="vacancy-response-button"]',
                'button[data-qa="vacancy-response-button"]',
                'a:has-text("Откликнуться")',
                'button:has-text("Откликнуться")',
                '.vacancy-response-button',
                'button[data-qa="response-button"]'
            ];
            
            for (const selector of buttonSelectors) {
                responseButton = await page.$(selector);
                if (responseButton) {
                    console.log(`✅ Найдена кнопка по селектору: ${selector}`);
                    break;
                }
            }
        }
        
        if (!responseButton) {
            console.log('⚠️ Кнопка отклика не найдена');
            await page.screenshot({ path: 'debug-no-response-button.png' });
            return { success: false, reason: 'no_response_button' };
        }
        
        // Генерируем сопроводительное письмо
        let coverLetter = '';
        
        if (useGemini) {
            try {
                console.log('🤖 Генерация сопроводительного письма...');
                coverLetter = await generateCoverLetter(vacancyData, resumeText, userPrompt);
                console.log('📨 Письмо сгенерировано');
            } catch (error) {
                console.log('⚠️ Gemini не доступен, используем шаблон');
                coverLetter = getTemplateLetter(vacancyData);
            }
        } else {
            coverLetter = getTemplateLetter(vacancyData);
        }
        
        // Кликаем по кнопке отклика
        await responseButton.click();
        console.log('✅ Кнопка нажата, ждём модальное окно...');
        await page.waitForTimeout(3000);
        
        // Сохраняем скриншот для отладки
        await page.screenshot({ path: `debug-form-${Date.now()}.png` });
        
        // Ищем поле для письма
        let letterField = null;
        
        // Пробуем стандартные селекторы
        const letterSelectors = [
            '[data-qa="response-letter"]',
            'textarea[name="letter"]',
            'textarea[placeholder*="письмо"]',
            'textarea[placeholder*="сопроводительное"]',
            'textarea'
        ];
        
        for (const selector of letterSelectors) {
            const element = await page.$(selector);
            if (element) {
                letterField = element;
                console.log(`✅ Найдено поле для письма: ${selector}`);
                break;
            }
        }
        
        if (letterField) {
            // Очищаем поле и вставляем письмо
            await letterField.fill('');
            await letterField.type(coverLetter, { delay: 50 });
            console.log('✍️ Письмо вставлено');
        } else {
            console.log('⚠️ Поле для письма не найдено');
        }
        
        // Ищем кнопку отправки
        let submitButton = null;
        
        const submitSelectors = [
            '[data-qa="response-submit"]',
            'button[type="submit"]',
            'button:has-text("Отправить")',
            'button:has-text("Откликнуться")',
            'input[type="submit"]',
            'button[data-qa="submit"]'
        ];
        
        for (const selector of submitSelectors) {
            const element = await page.$(selector);
            if (element) {
                submitButton = element;
                console.log(`✅ Найдена кнопка отправки: ${selector}`);
                break;
            }
        }
        
        if (!submitButton) {
            console.log('⚠️ Кнопка отправки не найдена');
            await page.screenshot({ path: 'debug-no-submit.png' });
            return { success: false, reason: 'no_submit_button' };
        }
        
        // Отправляем отклик
        await submitButton.click();
        console.log('📤 Отправляем отклик...');
        
        // Ждём подтверждения
        await page.waitForTimeout(3000);
        
        // Проверяем успешность
        const successSelectors = [
            '[data-qa="response-success-message"]',
            '.vacancy-response-success',
            'div:has-text("Отклик отправлен")',
            'div:has-text("Вы успешно откликнулись")',
            '[data-qa="vacancy-response-success"]'
        ];
        
        let success = false;
        for (const selector of successSelectors) {
            const element = await page.$(selector);
            if (element) {
                success = true;
                console.log(`✅ Найден признак успеха: ${selector}`);
                break;
            }
        }
        
        if (success) {
            console.log('✅ Отклик успешно отправлен!');
            
            const responseInfo = {
                id: vacancyData.id,
                title: vacancyData.title,
                company: vacancyData.company,
                url: vacancyUrl,
                timestamp: new Date().toISOString(),
                coverLetter: coverLetter ? coverLetter.substring(0, 100) + '...' : null
            };
            
            return { success: true, data: responseInfo };
            
        } else {
            console.log('⚠️ Не удалось подтвердить отправку');
            await page.screenshot({ path: 'debug-no-confirmation.png' });
            return { success: false, reason: 'no_confirmation' };
        }
        
    } catch (error) {
        console.error('❌ Ошибка отклика:', error.message);
        return { success: false, reason: 'error', error: error.message };
    }
}

/**
 * Закрытие модального окна
 */
export async function closeModal(page) {
    try {
        const closeButton = await page.$('[data-qa="modal-close"]');
        if (closeButton) {
            await closeButton.click();
            await page.waitForTimeout(1000);
        }
    } catch (e) {
        // Игнорируем ошибки закрытия
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
            results.details.push(result.data);
        } else {
            results.failed++;
        }
        
        // Пауза между откликами (кроме последнего)
        if (i < vacancies.length - 1 && results.success < maxResponses) {
            let pauseTime = delay;
            if (randomDelay) {
                pauseTime = delay + Math.random() * 60000; // +0..60 секунд
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

/**
 * Шаблонное письмо
 */
function getTemplateLetter(vacancy) {
    return `Здравствуйте! Меня заинтересовала вакансия ${vacancy.title} в компании ${vacancy.company}. Мой опыт и навыки соответствуют вашим требованиям. Буду рад обсудить детали на собеседовании.`;
}