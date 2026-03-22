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
    MODAL_WAIT_ATTEMPTS: 10,
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
        '[data-qa="response-letter"]',
        'textarea[name="letter"]',
        '[data-qa*="letter"]',
        'textarea'
    ],
    
    // Кнопка отправки
    SUBMIT_BUTTON: [
        '[data-qa="vacancy-response-submit-popup"]',
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
    
    // Признаки предупреждения о релокации
    RELOCATION_WARNING: {
        title: '[data-qa="relocation-warning-title"]',
        confirm: '[data-qa="relocation-warning-confirm"]',
        abort: '[data-qa="relocation-warning-abort"]'
    },
    
    // Признаки внешнего отклика
    EXTERNAL_RESPONSE: [
        'Вакансия с прямым откликом',
        'заполнив анкету на сайте работодателя',
        'Перейти на сайт',
        'На сайте работодателя',
        'внешний сайт'
    ],
    
    // Признаки ошибок
    ERROR_INDICATORS: [
        '[class*="error"]',
        '[data-qa*="error"]',
        '.bloko-text_color_alert'
    ]
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
    const buttons = await page.$$('button[type="submit"], [data-qa="vacancy-response-submit-popup"]');
    
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

async function isExternalResponse(page) {
    const result = await page.evaluate((indicators) => {
        const bodyText = document.body.innerText;
        for (const indicator of indicators) {
            if (bodyText.includes(indicator)) {
                return true;
            }
        }
        return false;
    }, SELECTORS.EXTERNAL_RESPONSE);
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

async function waitForModal(page) {
    let attempts = 0;
    
    while (attempts < TIMEOUTS.MODAL_WAIT_ATTEMPTS) {
        attempts++;
        await page.waitForTimeout(TIMEOUTS.MODAL_WAIT_DELAY);
        
        const modal = await page.$('[role="dialog"], .magritte-modal-content-wrapper___23XFT');
        if (modal) {
            console.log(`✅ Модальное окно появилось (попытка ${attempts})`);
            return modal;
        }
        
        // Проверяем, не перешли ли на страницу с вопросами
        const isResponsePage = page.url().includes('/applicant/vacancy_response');
        if (isResponsePage) {
            console.log(`✅ Переход на страницу отклика (попытка ${attempts})`);
            return null; // Сигнал, что это страница, а не модалка
        }
        
        if (attempts === 1) {
            console.log(`   ⏳ Ожидание модального окна (${attempts}/${TIMEOUTS.MODAL_WAIT_ATTEMPTS})...`);
        }
    }
    
    console.log('⚠️ Модальное окно не появилось');
    return null;
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
   ОСНОВНОЙ ЦИКЛИЧЕСКИЙ АЛГОРИТМ ОБРАБОТКИ МОДАЛЬНЫХ ОКОН
   ====================================================== */

/**
 * Рекурсивная обработка модальных окон
 * Возвращает true если отклик успешен
 */
async function processModalRecursive(page, resumeText, vacancyData, useGemini, userPrompt, depth = 0) {
    // Защита от бесконечной рекурсии
    if (depth > 5) {
        console.log('⚠️ Слишком много вложенных модальных окон, останавливаемся');
        return false;
    }
    
    console.log(`\n🔍 Обработка модального окна (уровень ${depth + 1})...`);
    
    // 1. ПРОВЕРЯЕМ ПРЕДУПРЕЖДЕНИЕ О РЕЛОКАЦИИ
    const relocationHandled = await handleRelocationWarning(page);
    if (relocationHandled) {
        console.log('✅ Предупреждение о релокации обработано');
        await page.waitForTimeout(1500);
        // После обработки предупреждения продолжаем проверять текущее окно
    }
    
    // 2. ПРОВЕРЯЕМ НАЛИЧИЕ ВОПРОСОВ
    const hasQuestions = await hasQuestionsOnPage(page);
    
    if (hasQuestions) {
        console.log('📋 Обнаружены вопросы');
        
        // Обрабатываем вопросы
        const answered = await answerQuestions(page, resumeText, vacancyData);
        
        if (!answered) {
            console.log('⚠️ Не удалось ответить на вопросы');
            return false;
        }
        
        console.log('✅ Ответы на вопросы отправлены');
        await page.waitForTimeout(2000);
        
        // ПОСЛЕ ОТВЕТОВ ПРОВЕРЯЕМ, НЕ ПОЯВИЛОСЬ ЛИ НОВОЕ ОКНО
        const newModal = await page.$('[role="dialog"], .magritte-modal-content-wrapper___23XFT');
        const isResponsePage = page.url().includes('/applicant/vacancy_response');
        
        if (newModal || isResponsePage) {
            console.log('🔄 После вопросов появилось новое окно, продолжаем обработку...');
            await page.waitForTimeout(1500);
            return await processModalRecursive(page, resumeText, vacancyData, useGemini, userPrompt, depth + 1);
        }
        
        // Если нового окна нет, ищем кнопку отправки
        const submitButton = await findActiveSubmitButton(page);
        if (submitButton) {
            await submitButton.click();
            await page.waitForTimeout(TIMEOUTS.PAUSE_AFTER_CLICK);
            return await checkSuccessWithRetry(page);
        }
        
        return false;
    }
    
    // 3. ЕСЛИ ВОПРОСОВ НЕТ - ИЩЕМ ПОЛЕ ДЛЯ ПИСЬМА
    console.log('📝 Вопросов нет, ищем поле для письма...');
    
    const letterField = await findLetterField(page, true);
    let letterFilled = false;
    
    if (letterField.element) {
        // Генерируем письмо
        const coverLetter = await generateCoverLetterWithFallback(vacancyData, resumeText, userPrompt, useGemini);
        
        // Заполняем поле
        letterFilled = await fillLetterField(page, letterField, coverLetter);
        
        if (letterFilled) {
            console.log('✍️ Письмо заполнено');
            await page.waitForTimeout(TIMEOUTS.BUTTON_ACTIVATE_WAIT);
        }
    } else {
        console.log('⚠️ Поле для письма не найдено');
    }
    
    // 4. ИЩЕМ КНОПКУ ОТПРАВКИ
    const submitButton = await findActiveSubmitButton(page);
    
    if (submitButton) {
        console.log('📤 Нажимаем кнопку отправки...');
        await submitButton.click();
        await page.waitForTimeout(TIMEOUTS.PAUSE_AFTER_CLICK);
        
        // ПОСЛЕ НАЖАТИЯ ПРОВЕРЯЕМ, НЕ ПОЯВИЛОСЬ ЛИ НОВОЕ ОКНО
        const newModal = await page.$('[role="dialog"], .magritte-modal-content-wrapper___23XFT');
        const isResponsePage = page.url().includes('/applicant/vacancy_response');
        
        if (newModal || isResponsePage) {
            console.log('🔄 После нажатия кнопки появилось новое окно, продолжаем обработку...');
            await page.waitForTimeout(1500);
            return await processModalRecursive(page, resumeText, vacancyData, useGemini, userPrompt, depth + 1);
        }
        
        // Если нового окна нет, проверяем успех
        return await checkSuccessWithRetry(page);
    }
    
    // 5. КНОПКИ НЕТ - ПРОВЕРЯЕМ УСПЕХ (возможно отправилось автоматически)
    console.log('🔍 Кнопка отправки не найдена, проверяем успех...');
    const success = await checkSuccessWithRetry(page);
    
    if (success) {
        return true;
    }
    
    // 6. ЕСЛИ НЕ УСПЕХ - ПРОВЕРЯЕМ, НЕ ПОЯВИЛОСЬ ЛИ НОВОЕ ОКНО
    const newModalAfter = await page.$('[role="dialog"], .magritte-modal-content-wrapper___23XFT');
    if (newModalAfter) {
        console.log('🔄 Появилось новое модальное окно, продолжаем обработку...');
        await page.waitForTimeout(1500);
        return await processModalRecursive(page, resumeText, vacancyData, useGemini, userPrompt, depth + 1);
    }
    
    return false;
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
        const alreadyResponded = await page.$('[data-qa="vacancy-response-success-message"]');
        if (alreadyResponded) {
            console.log('⚠️ Уже откликались на эту вакансию');
            return { success: false, reason: 'already_responded' };
        }
        
        // 5. Проверяем на внешний отклик
        const isExternal = await isExternalResponse(page);
        if (isExternal) {
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
        
        // 9. ЖДЕМ ПОЯВЛЕНИЯ МОДАЛЬНОГО ОКНА ИЛИ ПЕРЕХОДА НА СТРАНИЦУ
        const modal = await waitForModal(page);
        
        // Если модалки нет, проверяем успех
        if (!modal) {
            // Проверяем, не перешли ли на страницу с вопросами
            const isResponsePage = page.url().includes('/applicant/vacancy_response');
            if (isResponsePage) {
                console.log('📄 Переход на страницу отклика');
                // Рекурсивно обрабатываем страницу как модальное окно
                const success = await processModalRecursive(page, resumeText, vacancyData, useGemini, userPrompt);
                if (success) {
                    console.log('✅ Отклик успешно отправлен!');
                    return { success: true, data: vacancyData };
                }
                return { success: false, reason: 'modal_processing_failed' };
            }
            
            // Если нет ни модалки, ни страницы, проверяем успех
            const success = await checkSuccessWithRetry(page);
            if (success) {
                console.log('✅ Отклик успешно отправлен!');
                return { success: true, data: vacancyData };
            }
            return { success: false, reason: 'modal_not_found' };
        }
        
        // 10. ЗАПУСКАЕМ РЕКУРСИВНУЮ ОБРАБОТКУ МОДАЛЬНЫХ ОКОН
        const modalSuccess = await processModalRecursive(page, resumeText, vacancyData, useGemini, userPrompt);
        
        if (modalSuccess) {
            console.log('✅ Отклик успешно отправлен!');
            return { success: true, data: vacancyData };
        }
        
        console.log('⚠️ Не удалось обработать модальное окно');
        return { success: false, reason: 'modal_processing_failed' };
        
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
            '[data-qa="response-popup-close"]'
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