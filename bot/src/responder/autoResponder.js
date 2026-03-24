// src/responder/autoRespond.js
import { generateCoverLetter } from '../gemini/letterGenerator.js';
import { parseVacancyPage } from '../parser/vacancyParser.js';
import { detectPageType, answerQuestions } from './questionHandler.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ======================================================
   КОНСТАНТЫ
   ====================================================== */

const TIMEOUTS = {
    PAGE_LOAD: 90000,
    MODAL_WAIT_ATTEMPTS: 15,
    MODAL_WAIT_DELAY: 1500,
    ELEMENT_WAIT: 30000,
    TYPE_DELAY: 30,
    PAUSE_AFTER_CLICK: 2000,
    BUTTON_ACTIVATE_WAIT: 2000,
    BUTTON_ACTIVATE_ATTEMPTS: 15,
    SUCCESS_CHECK_ATTEMPTS: 20
};

const SELECTORS = {
    // Кнопка отклика
    RESPONSE_BUTTON: [
        '[data-qa="vacancy-response-link-top"]',
        '[data-qa="vacancy-response-button"]',
        'a:has-text("Откликнуться")',
        'button:has-text("Откликнуться")'
    ],
    
    // Поле для письма (на странице вакансии)
    LETTER_FIELD_ON_PAGE: [
        '[data-qa="vacancy-response-letter"]',
        '[data-qa="cover-letter"]',
        'textarea[name="letter"]',
        'textarea[name="message"]',
        '[data-qa*="letter"]'
    ],
    
    // Поле для письма (в модальном окне)
    LETTER_FIELD_IN_MODAL: [
        '[data-qa="vacancy-response-popup-form-letter-input"]',
        'textarea[data-qa="vacancy-response-popup-form-letter-input"]',
        'textarea[name="text"]',
        '[data-qa="response-letter"]',
        'textarea[name="letter"]',
        '[data-qa*="letter"]',
        'textarea'
    ],
    
    // Кнопка отправки
    SUBMIT_BUTTON: [
        '[data-qa="vacancy-response-submit-popup"]',
        '[data-qa="vacancy-response-letter-submit"]',
        'button[type="submit"]',
        'button:has-text("Откликнуться")',
        'button:has-text("Отправить")'
    ],
    
    // Успешные сообщения
    SUCCESS_MESSAGES: [
        'Резюме доставлено',
        'Отклик отправлен',
        'Вы успешно откликнулись',
        'Ваш отклик отправлен',
        'Отклик принят'
    ],
    
    // Признаки вопросов
    QUESTION_INDICATORS: [
        '[data-qa="employer-asking-for-test"]',
        '[data-qa="task-body"]',
        'textarea[name*="task"]',
        'input[type="radio"]'
    ],
    
    // Предупреждение о релокации
    RELOCATION_WARNING: {
        title: '[data-qa="relocation-warning-title"]',
        confirm: '[data-qa="relocation-warning-confirm"]',
        abort: '[data-qa="relocation-warning-abort"]',
        text: 'Вы откликаетесь на вакансию в другой стране'
    },
    
    // Предупреждение о внешнем отклике
    EXTERNAL_RESPONSE_WARNING: {
        title: 'Вакансия с прямым откликом',
        confirmLink: '[data-qa="vacancy-response-link-advertising"]',
        cancelButton: '[data-qa="vacancy-response-link-advertising-cancel"]',
        text: 'заполнив анкету на сайте работодателя'
    },
    
    // Признаки внешнего отклика на странице (до нажатия)
    EXTERNAL_RESPONSE_ON_PAGE: [
        'Вакансия с прямым откликом',
        'заполнив анкету на сайте работодателя',
        'Перейти на сайт',
        'На сайте работодателя'
    ],
    
    // Признаки ошибок
    ERROR_INDICATORS: [
        '[class*="error"]',
        '[data-qa*="error"]',
        '.bloko-text_color_alert'
    ],
    
    // Кнопка "Чат" (признак уже отправленного отклика)
    CHAT_BUTTON: '[data-qa="vacancy-response-link-view-topic"]'
};

/* ======================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ====================================================== */

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

function normalizeUrl(url) {
    if (!url) return url;
    return url.replace('karakan.hh.ru', 'hh.ru');
}

function getTemplateLetter(vacancy) {
    return `Здравствуйте! Меня заинтересовала вакансия ${vacancy.title} в компании ${vacancy.company}. Мой опыт и навыки соответствуют вашим требованиям. Буду рад обсудить детали на собеседовании.`;
}

/* ======================================================
   ПРОВЕРКА УСПЕХА ОТПРАВКИ
   ====================================================== */

async function checkSuccessWithRetry(page) {
    console.log('   🔍 Проверка подтверждения отправки...');
    
    for (let attempt = 0; attempt < TIMEOUTS.SUCCESS_CHECK_ATTEMPTS; attempt++) {
        // Проверяем успешные сообщения
        for (const text of SELECTORS.SUCCESS_MESSAGES) {
            try {
                const element = await page.getByText(text, { exact: false }).first();
                if (await element?.isVisible()) {
                    console.log(`   ✅ Найдено подтверждение: "${text}" (попытка ${attempt + 1})`);
                    return true;
                }
            } catch (e) {}
        }
        
        // Проверяем селекторы успеха
        const successSelectors = [
            '[data-qa="response-success-message"]',
            '[data-qa="response-success"]',
            '[data-qa="vacancy-response-success"]',
            'div:has-text("Резюме доставлено")'
        ];
        
        for (const selector of successSelectors) {
            try {
                const element = await page.$(selector);
                if (element && await element.isVisible()) {
                    console.log(`   ✅ Найдено подтверждение: ${selector} (попытка ${attempt + 1})`);
                    return true;
                }
            } catch (e) {}
        }
        
        // Проверяем URL - если на внешнем сайте, отклик не удался
        const currentUrl = page.url();
        if (!currentUrl.includes('hh.ru')) {
            console.log(`   ❌ Перенаправление на внешний сайт: ${currentUrl}`);
            return false;
        }
        
        // Проверяем, закрылось ли модальное окно
        const modal = await page.$('[role="dialog"], .magritte-modal-content-wrapper___23XFT');
        if (!modal) {
            console.log(`   ✅ Модальное окно закрылось (попытка ${attempt + 1})`);
            return true;
        }
        
        // Проверяем наличие ошибок
        for (const selector of SELECTORS.ERROR_INDICATORS) {
            try {
                const errorEl = await page.$(selector);
                if (errorEl && await errorEl.isVisible()) {
                    const errorText = await errorEl.textContent();
                    if (errorText && errorText.length > 0) {
                        console.log(`   ❌ Найдена ошибка: ${errorText}`);
                        return false;
                    }
                }
            } catch (e) {}
        }
        
        if (attempt < TIMEOUTS.SUCCESS_CHECK_ATTEMPTS - 1) {
            console.log(`   ⏳ Попытка ${attempt + 1}/${TIMEOUTS.SUCCESS_CHECK_ATTEMPTS} не дала результата, ждём...`);
            await page.waitForTimeout(2000);
        }
    }
    
    console.log('   ⚠️ Не удалось найти подтверждение отправки');
    return false;
}

/* ======================================================
   ФУНКЦИИ ПОИСКА ЭЛЕМЕНТОВ
   ====================================================== */

async function findResponseButton(page) {
    // Сначала проверяем, не откликались ли уже (есть кнопка "Чат")
    const chatButton = await page.$(SELECTORS.CHAT_BUTTON);
    if (chatButton && await chatButton.isVisible()) {
        console.log('⚠️ Кнопка "Чат" найдена - уже откликались');
        return null;
    }
    
    for (const selector of SELECTORS.RESPONSE_BUTTON) {
        const button = await page.$(selector);
        if (button && await button.isVisible()) {
            console.log(`✅ Найдена кнопка по селектору: ${selector}`);
            return button;
        }
    }
    
    console.log('⚠️ Кнопка отклика не найдена');
    return null;
}

async function findLetterField(page, inModal = false) {
    const selectors = inModal ? SELECTORS.LETTER_FIELD_IN_MODAL : SELECTORS.LETTER_FIELD_ON_PAGE;
    
    for (const selector of selectors) {
        try {
            const element = await page.$(selector);
            if (element) {
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    console.log(`✅ Найдено поле для письма: ${selector}`);
                    return { element, selector };
                }
            }
        } catch (e) {}
    }
    
    // Поиск через лейбл
    try {
        const labelElement = await page.getByText('Сопроводительное письмо').first();
        if (labelElement) {
            const textarea = await labelElement.evaluateHandle(el => {
                const parent = el.closest('[data-qa="textarea-wrapper"], .magritte-textarea___ugvor');
                return parent ? parent.querySelector('textarea') : null;
            });
            if (textarea && await textarea.asElement()?.isVisible()) {
                console.log(`✅ Найдено поле для письма через лейбл`);
                return { element: textarea.asElement(), selector: 'label' };
            }
        }
    } catch (e) {}
    
    console.log(`⚠️ Поле для письма не найдено (inModal: ${inModal})`);
    return { element: null, selector: null };
}

async function findActiveSubmitButton(page) {
    const buttons = await page.$$('button[type="submit"], [data-qa="vacancy-response-submit-popup"], [data-qa="vacancy-response-letter-submit"]');
    
    for (const btn of buttons) {
        const isVisible = await btn.isVisible();
        const isDisabled = await btn.evaluate(el => el.disabled).catch(() => true);
        if (isVisible && !isDisabled) {
            console.log(`✅ Найдена активная кнопка отправки`);
            return btn;
        }
    }
    return null;
}

/* ======================================================
   ПРОВЕРКИ
   ====================================================== */

async function hasQuestionsOnPage(page) {
    const result = await page.evaluate((indicators) => {
        for (const selector of indicators) {
            if (document.querySelector(selector)) {
                return true;
            }
        }
        return false;
    }, SELECTORS.QUESTION_INDICATORS);
    return result;
}

async function isExternalResponseOnPage(page) {
    const result = await page.evaluate((indicators) => {
        const bodyText = document.body.innerText;
        for (const indicator of indicators) {
            if (bodyText.includes(indicator)) {
                return true;
            }
        }
        return false;
    }, SELECTORS.EXTERNAL_RESPONSE_ON_PAGE);
    return result;
}

async function handleRelocationWarning(page) {
    const warningTitle = await page.$(SELECTORS.RELOCATION_WARNING.title);
    if (warningTitle && await warningTitle.isVisible()) {
        console.log('⚠️ Обнаружено предупреждение о релокации');
        
        const confirmButton = await page.$(SELECTORS.RELOCATION_WARNING.confirm);
        if (confirmButton && await confirmButton.isVisible()) {
            console.log('✅ Нажимаем "Все равно откликнуться"');
            await confirmButton.click();
            await page.waitForTimeout(2000);
            return true;
        }
    }
    return false;
}

async function handleExternalResponseWarning(page) {
    const cancelButton = await page.$(SELECTORS.EXTERNAL_RESPONSE_WARNING.cancelButton);
    if (cancelButton && await cancelButton.isVisible()) {
        console.log('⚠️ Обнаружено предупреждение о внешнем отклике');
        console.log('✅ Нажимаем "Отменить"');
        await cancelButton.click();
        await page.waitForTimeout(1000);
        return true;
    }
    return false;
}

async function hasSuccessMessage(page) {
    const successMsg = await page.$('.magritte-text___pbpft_4-5-1:has-text("Резюме доставлено")');
    if (successMsg && await successMsg.isVisible()) return true;
    
    for (const text of SELECTORS.SUCCESS_MESSAGES) {
        const element = await page.getByText(text, { exact: false }).first();
        if (await element?.isVisible()) return true;
    }
    return false;
}

async function hasFormError(page) {
    const errorMsg = await page.$('[data-qa="form-helper-error"]');
    if (errorMsg && await errorMsg.isVisible()) {
        const errorText = await errorMsg.textContent();
        if (errorText.includes('Произошла ошибка')) {
            console.log(`⚠️ Ошибка формы: ${errorText}`);
            return true;
        }
    }
    return false;
}

/* ======================================================
   ОЖИДАНИЕ ПОЯВЛЕНИЯ ЭЛЕМЕНТОВ ПОСЛЕ НАЖАТИЯ
   ====================================================== */

async function waitForElementsAfterClick(page) {
    let attempts = 0;
    
    while (attempts < TIMEOUTS.MODAL_WAIT_ATTEMPTS) {
        attempts++;
        await page.waitForTimeout(TIMEOUTS.MODAL_WAIT_DELAY);
        
        // 1. Поле для письма (главное)
        const letterField = await page.$('textarea[name="text"], [data-qa="vacancy-response-popup-form-letter-input"], textarea[name="letter"]');
        if (letterField && await letterField.isVisible()) {
            console.log(`✅ Поле для письма появилось (попытка ${attempts})`);
            return { type: 'letter_field', element: letterField };
        }
        
        // 2. Предупреждение о релокации (по data-qa)
        const relocationTitle = await page.$(SELECTORS.RELOCATION_WARNING.title);
        if (relocationTitle && await relocationTitle.isVisible()) {
            console.log(`⚠️ Предупреждение о релокации (попытка ${attempts})`);
            return { type: 'relocation', element: relocationTitle };
        }
        
        // 3. Предупреждение о внешнем отклике
        const externalLink = await page.$(SELECTORS.EXTERNAL_RESPONSE_WARNING.confirmLink);
        if (externalLink && await externalLink.isVisible()) {
            console.log(`⚠️ Предупреждение о внешнем отклике (попытка ${attempts})`);
            return { type: 'external', element: externalLink };
        }
        
        // 4. Стандартное модальное окно
        const modal = await page.$('[role="dialog"], .magritte-modal-content-wrapper___23XFT');
        if (modal) {
            console.log(`✅ Модальное окно появилось (попытка ${attempts})`);
            return { type: 'modal', element: modal };
        }
        
        // 5. Страница отклика
        const isResponsePage = page.url().includes('/applicant/vacancy_response');
        if (isResponsePage) {
            console.log(`✅ Переход на страницу отклика (попытка ${attempts})`);
            return { type: 'page', element: null };
        }
        
        // 6. Успешное сообщение
        const successMsg = await page.$('.magritte-text___pbpft_4-5-1:has-text("Резюме доставлено")');
        if (successMsg && await successMsg.isVisible()) {
            console.log(`✅ Сообщение об успехе (попытка ${attempts})`);
            return { type: 'success', element: null };
        }
        
        if (attempts === 1) {
            console.log(`   ⏳ Ожидание появления элементов (${attempts}/${TIMEOUTS.MODAL_WAIT_ATTEMPTS})...`);
        }
    }
    
    console.log('⚠️ Элементы после нажатия не появились');
    return { type: 'none', element: null };
}

/* ======================================================
   ЗАПОЛНЕНИЕ ПОЛЯ ДЛЯ ПИСЬМА
   ====================================================== */

async function fillLetterField(page, letterField, coverLetter) {
    try {
        const freshElement = await page.$(letterField.selector);
        if (!freshElement) throw new Error('Поле для письма исчезло');
        
        await freshElement.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(500);
        await freshElement.type(coverLetter, { 
            delay: TIMEOUTS.TYPE_DELAY,
            timeout: TIMEOUTS.ELEMENT_WAIT
        });
        console.log('✍️ Письмо введено');
        return true;
    } catch (error) {
        console.log('⚠️ Ошибка при вводе письма:', error.message);
        return false;
    }
}

/* ======================================================
   ГЕНЕРАЦИЯ ПИСЬМА
   ====================================================== */

async function generateCoverLetterWithFallback(vacancyData, resumeText, userPrompt, useGemini) {
    if (!useGemini) {
        return getTemplateLetter(vacancyData);
    }
    
    try {
        console.log('🤖 Генерация сопроводительного письма...');
        const coverLetter = await generateCoverLetter(vacancyData, resumeText, userPrompt);
        console.log(`📨 Письмо сгенерировано (${coverLetter.length} символов)`);
        return coverLetter;
    } catch (error) {
        console.log('⚠️ Gemini не доступен, используем шаблон');
        return getTemplateLetter(vacancyData);
    }
}

/* ======================================================
   ОСНОВНАЯ ФУНКЦИЯ АВТОМАТИЧЕСКОГО ОТКЛИКА
   ====================================================== */

export async function autoRespond(page, vacancyUrl, resumeText, userPrompt = '', options = {}) {
    try {
        const normalizedUrl = normalizeUrl(vacancyUrl);
        console.log(`\n📝 ОТКЛИК НА ВАКАНСИЮ: ${normalizedUrl}`);
        
        const { useGemini = true } = options;
        
        // 1. Загружаем страницу
        await withRetry(async () => {
            await page.goto(normalizedUrl, { 
                waitUntil: 'networkidle', 
                timeout: TIMEOUTS.PAGE_LOAD
            });
        }, 3, 5000);
        
        // 2. Парсим данные вакансии
        const vacancyData = await withRetry(async () => {
            return await parseVacancyPage(page);
        }, 3, 3000);
        
        // 3. Проверяем тип страницы ДО нажатия
        const initialPageType = await detectPageType(page);
        console.log(`📊 Тип страницы (до нажатия): ${initialPageType}`);

        if (initialPageType === 'test_task') {
            console.log('⏭️  Тестовое задание - пропускаем');
            return { success: false, reason: 'test_task', skipped: true };
        }
        
        console.log(`📋 Вакансия: ${vacancyData.title} в ${vacancyData.company}`);
        
        // 4. Проверяем, не откликались ли уже
        const alreadyResponded = await page.$(SELECTORS.CHAT_BUTTON);
        if (alreadyResponded && await alreadyResponded.isVisible()) {
            console.log('⚠️ Уже откликались на эту вакансию (есть кнопка "Чат")');
            return { success: false, reason: 'already_responded', skipped: true };
        }
        
        const successMessage = await page.$('.magritte-text___pbpft_4-5-1:has-text("Резюме доставлено")');
        if (successMessage && await successMessage.isVisible()) {
            console.log('⚠️ Уже откликались на эту вакансию (есть сообщение)');
            return { success: false, reason: 'already_responded', skipped: true };
        }
        
        // 5. Проверяем на внешний отклик на странице
        const isExternalOnPage = await isExternalResponseOnPage(page);
        if (isExternalOnPage) {
            console.log('⚠️ Вакансия с внешним откликом - пропускаем');
            return { success: false, reason: 'external_response', skipped: true };
        }
        
        // 6. ИЩЕМ ПОЛЕ ДЛЯ ПИСЬМА НА СТРАНИЦЕ (ДО НАЖАТИЯ КНОПКИ)
        const { element: letterFieldOnPage, selector: letterSelectorOnPage } = await findLetterField(page, false);
        
        // 7. ЕСЛИ ЕСТЬ ПОЛЕ ДЛЯ ПИСЬМА НА СТРАНИЦЕ - ЗАПОЛНЯЕМ
        if (letterFieldOnPage && letterSelectorOnPage) {
            console.log('📝 Найдено поле для письма на странице, заполняем...');
            const coverLetter = await generateCoverLetterWithFallback(vacancyData, resumeText, userPrompt, useGemini);
            await fillLetterField(page, { element: letterFieldOnPage, selector: letterSelectorOnPage }, coverLetter);
        }
        
        // 8. НАЖИМАЕМ КНОПКУ ОТКЛИКА
        const responseButton = await withRetry(async () => {
            const button = await findResponseButton(page);
            if (!button) throw new Error('Кнопка отклика не найдена');
            return button;
        }, 3, 2000);
        
        await withRetry(async () => {
            await responseButton.click();
            await page.waitForTimeout(TIMEOUTS.PAUSE_AFTER_CLICK);
        }, 3, 2000);
        
        console.log('✅ Кнопка отклика нажата');
        
        // 9. ЖДЕМ ПОЯВЛЕНИЯ ЭЛЕМЕНТОВ ПОСЛЕ НАЖАТИЯ
        const afterClickResult = await waitForElementsAfterClick(page);
        
        // 9a. Если сразу успех
        if (afterClickResult.type === 'success') {
            console.log('✅ Отклик успешно отправлен!');
            return { success: true, data: vacancyData };
        }
        
        // 9b. Если предупреждение о внешнем отклике - пропускаем
        if (afterClickResult.type === 'external') {
            console.log('⚠️ Вакансия с внешним откликом - пропускаем');
            await handleExternalResponseWarning(page);
            return { success: false, reason: 'external_response', skipped: true };
        }
        
        // 9c. Если предупреждение о релокации - обрабатываем и продолжаем
        if (afterClickResult.type === 'relocation') {
            const handled = await handleRelocationWarning(page);
            if (handled) {
                console.log('✅ Предупреждение о релокации обработано');
                // После обработки предупреждения ждем появления поля для письма
                const retryResult = await waitForElementsAfterClick(page);
                
                if (retryResult.type === 'letter_field') {
                    afterClickResult.type = 'letter_field';
                    afterClickResult.element = retryResult.element;
                } else if (retryResult.type === 'success') {
                    console.log('✅ Отклик успешно отправлен!');
                    return { success: true, data: vacancyData };
                } else {
                    console.log('⚠️ После релокации ничего не появилось');
                    return { success: false, reason: 'no_elements_after_relocation' };
                }
            }
        }
        
        // 9d. Если есть поле для письма - заполняем и отправляем
        if (afterClickResult.type === 'letter_field') {
            console.log('📝 Найдено поле для письма, заполняем...');
            
            // Генерируем письмо (если еще не сгенерировали)
            const coverLetter = await generateCoverLetterWithFallback(vacancyData, resumeText, userPrompt, useGemini);
            
            // Заполняем поле
            const letterField = { element: afterClickResult.element, selector: 'textarea' };
            const filled = await fillLetterField(page, letterField, coverLetter);
            
            if (filled) {
                console.log('✍️ Письмо введено, ждем активации кнопки...');
                await page.waitForTimeout(TIMEOUTS.BUTTON_ACTIVATE_WAIT);
                
                // Ищем кнопку отправки
                const submitButton = await findActiveSubmitButton(page);
                
                if (submitButton) {
                    console.log('📤 Нажимаем кнопку отправки...');
                    await submitButton.click();
                    await page.waitForTimeout(TIMEOUTS.PAUSE_AFTER_CLICK);
                    
                    // Проверяем успех
                    const success = await checkSuccessWithRetry(page);
                    if (success) {
                        console.log('✅ Отклик успешно отправлен!');
                        return { success: true, data: vacancyData };
                    }
                } else {
                    console.log('⚠️ Кнопка отправки не найдена');
                }
            }
        }
        
        // 9e. Если есть страница с вопросами
        const isResponsePage = page.url().includes('/applicant/vacancy_response');
        if (isResponsePage) {
            const hasQuestions = await hasQuestionsOnPage(page);
            if (hasQuestions) {
                console.log('📋 Обнаружены вопросы на странице');
                const answered = await answerQuestions(page, resumeText, vacancyData);
                
                if (answered) {
                    console.log('✅ Ответы на вопросы отправлены');
                    await page.waitForTimeout(2000);
                    
                    const success = await checkSuccessWithRetry(page);
                    if (success) {
                        console.log('✅ Отклик успешно отправлен!');
                        return { success: true, data: vacancyData };
                    }
                }
            }
        }
        
        // 9f. Если есть модальное окно с вопросами
        if (afterClickResult.type === 'modal') {
            const hasQuestions = await hasQuestionsOnPage(page);
            if (hasQuestions) {
                console.log('📋 Обнаружены вопросы в модальном окне');
                const answered = await answerQuestions(page, resumeText, vacancyData);
                
                if (answered) {
                    console.log('✅ Ответы на вопросы отправлены');
                    await page.waitForTimeout(2000);
                    
                    // После ответов могло появиться поле для письма
                    const retryResult = await waitForElementsAfterClick(page);
                    if (retryResult.type === 'letter_field') {
                        const coverLetter = await generateCoverLetterWithFallback(vacancyData, resumeText, userPrompt, useGemini);
                        const letterField = { element: retryResult.element, selector: 'textarea' };
                        await fillLetterField(page, letterField, coverLetter);
                        await page.waitForTimeout(TIMEOUTS.BUTTON_ACTIVATE_WAIT);
                        
                        const submitButton = await findActiveSubmitButton(page);
                        if (submitButton) {
                            await submitButton.click();
                            await page.waitForTimeout(TIMEOUTS.PAUSE_AFTER_CLICK);
                        }
                    }
                    
                    const success = await checkSuccessWithRetry(page);
                    if (success) {
                        console.log('✅ Отклик успешно отправлен!');
                        return { success: true, data: vacancyData };
                    }
                }
            }
        }
        
        // 9g. Проверяем ошибку формы
        const hasError = await hasFormError(page);
        if (hasError) {
            console.log('⚠️ Ошибка в форме, пропускаем');
            return { success: false, reason: 'form_error', skipped: true };
        }
        
        // 10. Финальная проверка успеха
        const finalSuccess = await checkSuccessWithRetry(page);
        
        if (finalSuccess) {
            console.log('✅ Отклик успешно отправлен!');
            return { success: true, data: vacancyData };
        }
        
        console.log('⚠️ Не удалось подтвердить отправку');
        return { success: false, reason: 'no_confirmation' };
        
    } catch (error) {
        console.error('❌ Ошибка отклика:', error.message);
        return { success: false, reason: 'error', error: error.message };
    }
}

/* ======================================================
   ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА
   ====================================================== */

export async function closeModal(page) {
    try {
        const closeButtonSelectors = [
            '[data-qa="modal-close"]',
            '[data-qa="dialog-close"]',
            '[data-qa="close-button"]',
            '[aria-label="Закрыть"]',
            'button:has-text("×")',
            'button:has-text("Закрыть")',
            '[data-qa="response-popup-close"]',
            SELECTORS.EXTERNAL_RESPONSE_WARNING.cancelButton
        ];
        
        for (const selector of closeButtonSelectors) {
            const closeButton = await page.$(selector);
            if (closeButton && await closeButton.isVisible()) {
                await closeButton.click();
                await page.waitForTimeout(1000);
                return true;
            }
        }
        
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
        return true;
    } catch (error) {
        console.error('❌ Ошибка при закрытии модального окна:', error.message);
        return false;
    }
}

/* ======================================================
   ПАКЕТНЫЙ ОТКЛИК
   ====================================================== */

function loadData(filePath) {
    try {
        const fullPath = path.join(__dirname, '..', '..', filePath);
        if (fs.existsSync(fullPath)) {
            return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        }
    } catch (e) {}
    return [];
}

function saveData(filePath, data) {
    try {
        const fullPath = path.join(__dirname, '..', '..', filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.log(`⚠️ Ошибка сохранения ${filePath}: ${e.message}`);
    }
}

export async function batchRespond(page, vacancies, resumeText, userPrompt = '', options = {}) {
    const {
        delay = 30000,
        randomDelay = true,
        maxResponses = 80,
        pendingFile = 'pending-responses.json',
        completedFile = 'completed-responses.json',
        onSuccess = null,
        onError = null,
        onHtmlSave = null,
        ...otherOptions
    } = options;
    
    console.log(`\n🚀 ЗАПУСК ПАКЕТНОГО ОТКЛИКА`);
    console.log(`📊 Всего вакансий: ${vacancies.length}`);
    console.log(`⏱️  Задержка: ${delay/1000} сек ${randomDelay ? '(рандомная)' : ''}`);
    
    let pendingResponses = loadData(pendingFile);
    let completedResponses = loadData(completedFile);
    
    console.log(`📋 В очереди: ${pendingResponses.length}, Выполнено: ${completedResponses.length}`);
    
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
        
        const alreadyCompleted = completedResponses.find(r => r.url === vacancy.url);
        const alreadyPending = pendingResponses.find(r => r.url === vacancy.url);
        
        if (alreadyCompleted) {
            console.log(`⏭️  Уже откликались (${alreadyCompleted.timestamp})`);
            results.skipped++;
            continue;
        }
        
        if (alreadyPending) {
            console.log(`⏳ Уже в очереди (добавлено: ${alreadyPending.addedAt})`);
            results.skipped++;
            continue;
        }
        
        const pendingItem = {
            id: vacancy.id || Date.now().toString(),
            title: vacancy.title,
            company: vacancy.company,
            url: vacancy.url,
            status: 'pending',
            addedAt: new Date().toISOString()
        };
        
        pendingResponses.push(pendingItem);
        saveData(pendingFile, pendingResponses);
        console.log(`📌 Добавлено в очередь (всего: ${pendingResponses.length})`);
        
        let result = null;
        
        try {
            result = await autoRespond(page, vacancy.url, resumeText, userPrompt, otherOptions);
        } catch (error) {
            result = { success: false, error: error };
        }
        
        pendingResponses = pendingResponses.filter(p => p.url !== vacancy.url);
        saveData(pendingFile, pendingResponses);
        
        if (result.success) {
            results.success++;
            
            const completedItem = {
                id: vacancy.id || Date.now().toString(),
                title: vacancy.title,
                company: vacancy.company,
                url: vacancy.url,
                timestamp: new Date().toISOString(),
                coverLetter: result.data?.coverLetter || '',
                status: 'completed'
            };
            
            completedResponses.push(completedItem);
            saveData(completedFile, completedResponses);
            
            console.log(`✅ Отклик успешен! Всего выполнено: ${completedResponses.length}`);
            if (result.data) results.details.push(result.data);
            
            if (onSuccess) {
                try {
                    await onSuccess(result, vacancy);
                } catch (e) {
                    console.log(`⚠️ Ошибка в onSuccess: ${e.message}`);
                }
            }
            
        } else {
            results.failed++;
            console.log(`❌ Ошибка отклика: ${result.error?.message || 'Неизвестная ошибка'}`);
            
            if (onHtmlSave && page) {
                try {
                    await onHtmlSave(page, vacancy.url, 'error', {
                        vacancy: vacancy.title,
                        error: result.error?.message
                    });
                } catch (e) {
                    console.log(`⚠️ Не удалось сохранить HTML: ${e.message}`);
                }
            }
            
            if (onError) {
                try {
                    await onError(result.error || new Error('Неизвестная ошибка'), vacancy);
                } catch (e) {
                    console.log(`⚠️ Ошибка в onError: ${e.message}`);
                }
            }
        }
        
        if (i < vacancies.length - 1 && results.success < maxResponses) {
            let pauseTime = randomDelay ? delay + Math.random() * 60000 : delay;
            console.log(`⏳ Пауза ${Math.round(pauseTime/1000)} сек...`);
            await new Promise(resolve => setTimeout(resolve, pauseTime));
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 ИТОГИ ОТКЛИКОВ');
    console.log('='.repeat(50));
    console.log(`✅ Успешно: ${results.success}`);
    console.log(`❌ Ошибок: ${results.failed}`);
    console.log(`⏭️  Пропущено: ${results.skipped}`);
    console.log(`📋 Осталось в очереди: ${pendingResponses.length}`);
    console.log('='.repeat(50));
    
    return results;
}