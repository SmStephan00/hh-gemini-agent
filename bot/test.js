// test.js
import { launchStealthBrowser } from './src/browser/stealthLauncher.js';
import { manualAuth, checkAuth, logout } from './src/auth/hhAuth.js';
import { searchVacancies, filterVacancies, sortVacancies } from './src/search/vacancySearch.js';
import { autoRespond, batchRespond } from './src/responder/autoResponder.js';
import { loadResumeFromPdf } from './src/resume/pdfLoader.js';
import { DailyCounter } from './src/counter/dailyCounter.js';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== КОНФИГУРАЦИЯ =====
const PATHS = {
    LOGS: path.join(__dirname, 'logs'),
    HTML_DEBUG: path.join(__dirname, 'debug-html'),
    RESULTS: path.join(__dirname, 'results'),
    DATA: path.join(__dirname, 'bot-data.json')
};

// Создаем директории
Object.values(PATHS).forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// ===== ЛОГГЕР =====
class Logger {
    constructor() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.logFile = path.join(PATHS.LOGS, `bot-${timestamp}.log`);
        this.errorFile = path.join(PATHS.LOGS, `errors-${timestamp}.log`);
        this.init();
    }
    
    init() {
        const header = `\n${'='.repeat(60)}\n`;
        const startTime = `Лог запущен: ${new Date().toISOString()}\n`;
        fs.writeFileSync(this.logFile, header + startTime + header + '\n');
        fs.writeFileSync(this.errorFile, header + startTime + header + '\n');
    }
    
    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] ${message}\n`;
        console.log(message);
        fs.appendFileSync(this.logFile, logLine);
    }
    
    error(message, error = null, context = null) {
        const timestamp = new Date().toISOString();
        let errorLine = `[${timestamp}] [ERROR] ${message}\n`;
        
        if (error) {
            errorLine += `   Ошибка: ${error.message}\n`;
            if (error.stack) {
                errorLine += `   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}\n`;
            }
        }
        
        if (context) {
            errorLine += `   Контекст: ${JSON.stringify(context, null, 2)}\n`;
        }
        
        console.error(`❌ ${message}`);
        fs.appendFileSync(this.errorFile, errorLine);
        fs.appendFileSync(this.logFile, errorLine);
    }
    
    /**
     * Сохраняет HTML страницы для анализа (вместо скриншота)
     * Парсит только важные элементы: формы, поля, кнопки
     */
    /**
 * Сохраняет HTML страницы для анализа (вместо скриншота)
 * Парсит только важные элементы: формы, поля, кнопки
 */
async savePageHTML(page, url, reason, extra = {}) {
    try {
        const timestamp = Date.now();
        const filename = `${reason}-${timestamp}.json`;
        const filepath = path.join(PATHS.HTML_DEBUG, filename);
        
        // Парсим только важные элементы (без :has-text)
        const criticalHTML = await page.evaluate(() => {
            const importantSelectors = [
                // Формы и модалки
                'form',
                '[role="dialog"]',
                '.magritte-modal',
                '[data-qa="modal-content"]',
                '[class*="modal"]',
                
                // Поля отклика
                '[data-qa*="response"]',
                '[data-qa*="vacancy"]',
                '[data-qa*="letter"]',
                '[data-qa*="task"]',
                
                // Поля ввода
                'textarea',
                'input[type="text"]',
                'input[type="radio"]',
                'input[type="checkbox"]',
                'input[type="email"]',
                'input[type="tel"]',
                'input:not([type])',
                
                // Кнопки (ищем по атрибутам, а не по тексту)
                'button[type="submit"]',
                'button[data-qa*="submit"]',
                'button[data-qa*="response"]',
                'button[class*="submit"]',
                'button[class*="response"]',
                
                // Сообщения об ошибках/успехе
                '[class*="error"]',
                '[class*="success"]',
                '[data-qa*="error"]',
                '[data-qa*="success"]',
                '.error-message',
                '.success-message'
            ];
            
            const importantElements = [];
            for (const selector of importantSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        // Получаем только значимую информацию
                        importantElements.push({
                            selector: selector,
                            tagName: el.tagName,
                            type: el.type || null,
                            name: el.name || null,
                            id: el.id || null,
                            className: el.className || null,
                            visible: el.offsetParent !== null,
                            disabled: el.disabled || false,
                            text: el.textContent?.trim().substring(0, 300) || null,
                            value: el.value?.substring(0, 200) || null,
                            placeholder: el.placeholder || null,
                            required: el.required || false,
                            html: el.outerHTML.substring(0, 800)
                        });
                    });
                } catch (e) {
                    // Игнорируем ошибки при отдельных селекторах
                }
            }
            
            // Дополнительно ищем кнопки с текстом "Откликнуться" через XPath
            const buttonsWithText = [];
            const allButtons = document.querySelectorAll('button, a');
            allButtons.forEach(btn => {
                const text = btn.textContent?.trim() || '';
                if (text.includes('Откликнуться') || text.includes('Отправить') || text.includes('Submit')) {
                    buttonsWithText.push({
                        selector: 'button, a',
                        tagName: btn.tagName,
                        text: text.substring(0, 100),
                        visible: btn.offsetParent !== null,
                        disabled: btn.disabled || false,
                        href: btn.href || null,
                        html: btn.outerHTML.substring(0, 500)
                    });
                }
            });
            
            // Получаем текущий URL и title
            return {
                url: window.location.href,
                title: document.title,
                timestamp: Date.now(),
                importantElements: importantElements,
                buttonsWithText: buttonsWithText,
                formHTML: document.querySelector('form')?.outerHTML.substring(0, 2000) || null
            };
        });
        
        const debugData = {
            timestamp: new Date().toISOString(),
            reason: reason,
            url: url,
            extra: extra,
            pageAnalysis: criticalHTML
        };
        
        fs.writeFileSync(filepath, JSON.stringify(debugData, null, 2));
        this.log(`📄 Сохранен HTML для анализа: ${filename} (причина: ${reason})`, 'DEBUG');
        
        return filepath;
    } catch (e) {
        this.error(`Не удалось сохранить HTML страницы: ${e.message}`);
        return null;
    }
}
}

// Глобальный экземпляр логгера
let logger = null;

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С ДАННЫМИ =====

function loadData() {
    try {
        const data = fs.readFileSync(PATHS.DATA, 'utf8');
        return JSON.parse(data);
    } catch {
        return {
            lastUpdated: new Date().toISOString(),
            stats: {
                totalResponses: 0,
                successful: 0,
                failed: 0,
                skipped: 0,
                byDate: {}
            },
            pending: [],
            completed: [],
            errors: []
        };
    }
}

function saveData(data) {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(PATHS.DATA, JSON.stringify(data, null, 2));
    console.log(`💾 Данные сохранены в ${PATHS.DATA}`);
}

function addCompletedResponse(responseData) {
    const data = loadData();
    data.completed.unshift(responseData);
    data.stats.totalResponses++;
    data.stats.successful++;
    
    const today = new Date().toISOString().split('T')[0];
    if (!data.stats.byDate[today]) {
        data.stats.byDate[today] = { success: 0, failed: 0, skipped: 0 };
    }
    data.stats.byDate[today].success++;
    
    if (data.completed.length > 1000) data.completed = data.completed.slice(0, 1000);
    saveData(data);
}

function addError(errorData, vacancyInfo) {
    const data = loadData();
    
    const errorEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        vacancy: vacancyInfo,
        error: errorData.message || errorData,
        type: errorData.type || 'unknown',
        htmlFile: errorData.htmlFile || null
    };
    
    data.errors.unshift(errorEntry);
    data.stats.totalResponses++;
    data.stats.failed++;
    
    const today = new Date().toISOString().split('T')[0];
    if (!data.stats.byDate[today]) {
        data.stats.byDate[today] = { success: 0, failed: 0, skipped: 0 };
    }
    data.stats.byDate[today].failed++;
    
    if (data.errors.length > 500) data.errors = data.errors.slice(0, 500);
    saveData(data);
}

function addToPending(vacancy) {
    const data = loadData();
    const pendingEntry = {
        id: vacancy.id || Date.now().toString(),
        title: vacancy.title,
        company: vacancy.company,
        url: vacancy.url,
        addedAt: new Date().toISOString(),
        status: 'pending'
    };
    
    const exists = data.pending.some(p => p.url === vacancy.url);
    if (!exists) {
        data.pending.push(pendingEntry);
        saveData(data);
        console.log(`📌 Добавлено в ожидание: ${vacancy.title}`);
    }
}

function removeFromPending(vacancyUrl) {
    const data = loadData();
    const originalLength = data.pending.length;
    data.pending = data.pending.filter(p => p.url !== vacancyUrl);
    
    if (originalLength !== data.pending.length) {
        saveData(data);
    }
}

function getFrontendData() {
    const data = loadData();
    return {
        lastUpdated: data.lastUpdated,
        stats: data.stats,
        pending: data.pending,
        completed: data.completed.slice(0, 100),
        errors: data.errors.slice(0, 50)
    };
}

// ===== ОСТАЛЬНОЙ КОД =====

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});

function ask(query) {
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            resolve(answer.trim());
        });
    });
}

async function pressEnter(message) {
    console.log(message);
    await ask('⏎ Нажми Enter чтобы продолжить...');
}

process.on('SIGINT', async () => {
    console.log('\n\n⚠️ Прервано пользователем');
    if (logger) logger.log('⚠️ Прервано пользователем');
    rl.close();
    process.exit(0);
});

// ===== ОСНОВНАЯ ФУНКЦИЯ =====
async function main() {
    // Инициализируем логгер
    logger = new Logger();
    
    console.log('\n' + '='.repeat(60));
    console.log('🚀 HH.RU АВТОМАТИЧЕСКИЙ БОТ ДЛЯ ОТКЛИКОВ');
    console.log('='.repeat(60));
    
    logger.log('🚀 ЗАПУСК БОТА');
    
    // Проверка API ключей
    console.log('\n🔑 ПРОВЕРКА API КЛЮЧЕЙ:');
    console.log(`   Gemini: ${process.env.GEMINI_API_KEY ? '✅ Есть' : '❌ Нет'}`);
    console.log(`   OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✅ Есть' : '❌ Нет'}`);
    console.log(`   Прокси: ${process.env.VITE_PROXY_URL ? '✅ Есть' : '❌ Нет'}`);
    
    logger.log(`API ключи: Gemini=${!!process.env.GEMINI_API_KEY}, OpenRouter=${!!process.env.OPENROUTER_API_KEY}`);
    
    if (!process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY) {
        console.log('❌ Нет ни одного API ключа!');
        logger.error('Нет ни одного API ключа');
        rl.close();
        return;
    }
    
    console.log('✅ Настройки загружены');
    
    // Запуск браузера
    console.log('\n🚀 Запуск браузера...');
    logger.log('Запуск браузера');
    const { browser, page } = await launchStealthBrowser();
    
    try {
        // Авторизация
        console.log('\n' + '='.repeat(60));
        console.log('🚀 АВТОРИЗАЦИЯ НА HH.RU');
        console.log('='.repeat(60));
        logger.log('Начало авторизации');
        
        const authSuccess = await manualAuth(page, rl);
        
        if (!authSuccess) {
            console.log('❌ Не удалось авторизоваться');
            logger.error('Не удалось авторизоваться');
            return;
        }
        
        console.log('✅ Успешная авторизация!');
        logger.log('✅ Успешная авторизация');
        
        // ГЛАВНОЕ МЕНЮ
        let running = true;
        while (running) {
            console.log('\n' + '='.repeat(60));
            console.log('🚀 ГЛАВНОЕ МЕНЮ');
            console.log('='.repeat(60));
            console.log('1 - Поиск вакансий');
            console.log('2 - Автоматические отклики');
            console.log('3 - Проверить авторизацию');
            console.log('4 - Выйти из аккаунта');
            console.log('5 - Показать статистику');
            console.log('0 - Выход');
            
            const choice = await ask('\n👉 Выберите действие (0-5): ');
            
            if (choice === '0') {
                console.log('\n👋 Завершение работы...');
                logger.log('Завершение работы');
                running = false;
                break;
            }
            
            if (choice === '5') {
                const data = getFrontendData();
                console.log('\n📊 СТАТИСТИКА:');
                console.log(`   Всего откликов: ${data.stats.totalResponses}`);
                console.log(`   ✅ Успешно: ${data.stats.successful}`);
                console.log(`   ❌ Ошибок: ${data.stats.failed}`);
                console.log(`   ⏭️  Пропущено: ${data.stats.skipped || 0}`);
                console.log(`   📋 В очереди: ${data.pending.length}`);
                console.log(`   📁 Логи: ${PATHS.LOGS}`);
                console.log(`   📁 HTML для анализа: ${PATHS.HTML_DEBUG}`);
                console.log(`   📅 Последнее обновление: ${data.lastUpdated}`);
                logger.log(`Статистика: успешно=${data.stats.successful}, ошибок=${data.stats.failed}`);
                await pressEnter('\nНажми Enter чтобы продолжить...');
                continue;
            }
            
            if (choice === '3') {
                console.log('\n' + '='.repeat(60));
                console.log('🔐 ПРОВЕРКА АВТОРИЗАЦИИ');
                console.log('='.repeat(60));
                const isAuthed = await checkAuth(page);
                console.log(isAuthed ? '✅ Вы авторизованы' : '❌ Сессия не активна');
                logger.log(`Проверка авторизации: ${isAuthed}`);
                await pressEnter('\nНажми Enter чтобы продолжить...');
                continue;
            }
            
            if (choice === '4') {
                console.log('\n' + '='.repeat(60));
                console.log('🚪 ВЫХОД ИЗ АККАУНТА');
                console.log('='.repeat(60));
                await logout(page);
                console.log('✅ Вы вышли из аккаунта');
                logger.log('Выход из аккаунта');
                running = false;
                break;
            }
            
            if (choice === '1') {
                // РЕЖИМ ПОИСКА ВАКАНСИЙ
                console.log('\n' + '='.repeat(60));
                console.log('🔍 ПОИСК ВАКАНСИЙ');
                console.log('='.repeat(60));
                
                const query = await ask('🔍 Поисковый запрос (например "frontend разработчик"): ');
                
                if (!query) {
                    console.log('⚠️ Поисковый запрос не может быть пустым');
                    continue;
                }
                
                console.log('\n📋 Дополнительные параметры (Enter - пропустить):');
                const excludeInput = await ask('🚫 Исключить слова (через запятую): ');
                const maxPages = await ask('📄 Количество страниц (по умолчанию 3): ');
                
                const excludeWords = excludeInput ? excludeInput.split(',').map(w => w.trim()) : [];
                
                console.log('\n🔍 ПОИСК...');
                logger.log(`Поиск вакансий: "${query}"`);
                
                const vacancies = await searchVacancies(page, query, {
                    maxPages: parseInt(maxPages) || 3,
                    delay: 2000
                });
                
                if (vacancies.length === 0) {
                    console.log('⚠️ Вакансии не найдены');
                    logger.log('Вакансии не найдены');
                    continue;
                }
                
                console.log(`✅ Найдено ${vacancies.length} вакансий`);
                logger.log(`Найдено ${vacancies.length} вакансий`);
                
                const filtered = filterVacancies(vacancies, excludeWords);
                
                if (filtered.length < vacancies.length) {
                    console.log(`✅ После фильтрации: ${filtered.length} вакансий`);
                }
                
                const filename = `vacancies-${Date.now()}.json`;
                fs.writeFileSync(filename, JSON.stringify(filtered, null, 2));
                console.log(`💾 Результаты сохранены в ${filename}`);
                
                console.log('\n📋 ПЕРВЫЕ 10 ВАКАНСИЙ:');
                console.log('-'.repeat(60));
                
                filtered.slice(0, 10).forEach((v, i) => {
                    console.log(`\n${i + 1}. ${v.title}`);
                    console.log(`   🏢 ${v.company}`);
                    console.log(`   💰 ${v.salary || 'з/п не указана'}`);
                    console.log(`   📍 ${v.city}`);
                });
                
                await pressEnter('\nНажми Enter чтобы продолжить...');
            }
            
            if (choice === '2') {
                // РЕЖИМ АВТОМАТИЧЕСКИХ ОТКЛИКОВ
                console.log('\n' + '='.repeat(60));
                console.log('🤖 АВТОМАТИЧЕСКИЕ ОТКЛИКИ');
                console.log('='.repeat(60));
                logger.log('Запуск режима автоматических откликов');
                
                // 1. Проверяем файл с резюме
                const defaultPdfPath = path.join(__dirname, 'resume.pdf');
                let pdfPath = '';
                
                if (fs.existsSync(defaultPdfPath)) {
                    console.log(`\n📄 Найден файл: ${defaultPdfPath}`);
                    const useDefault = await ask('Использовать этот файл? (y/n): ');
                    if (useDefault.toLowerCase() === 'y') {
                        pdfPath = defaultPdfPath;
                    }
                }
                
                if (!pdfPath) {
                    pdfPath = await ask('\n📄 Путь к PDF с резюме: ');
                }
                
                if (!fs.existsSync(pdfPath)) {
                    console.log('❌ Файл не найден');
                    logger.error(`Файл резюме не найден: ${pdfPath}`);
                    continue;
                }
                
                console.log('\n📤 Загрузка резюме...');
                const resumeText = await loadResumeFromPdf(pdfPath);
                console.log(`✅ Резюме загружено (${resumeText.length} символов)`);
                logger.log(`Резюме загружено: ${resumeText.length} символов`);
                
                const userPrompt = await ask('\n📝 Дополнительные пожелания к письму (Enter - пропустить): ');
                
                const query = await ask('\n🔍 Поисковый запрос для вакансий: ');
                
                if (!query) {
                    console.log('⚠️ Поисковый запрос не может быть пустым');
                    continue;
                }
                
                const maxPages = await ask('📄 Количество страниц для поиска (по умолчанию 3): ');
                
                console.log('\n' + '='.repeat(60));
                console.log('🚀 ПОИСК ВАКАНСИЙ');
                console.log('='.repeat(60));
                logger.log(`Поиск вакансий для отклика: "${query}"`);
                
                const vacancies = await searchVacancies(page, query, {
                    maxPages: parseInt(maxPages) || 3,
                    delay: 2000
                });
                
                if (vacancies.length === 0) {
                    console.log('⚠️ Вакансии не найдены');
                    logger.log('Вакансии не найдены');
                    continue;
                }
                
                console.log(`✅ Найдено ${vacancies.length} вакансий`);
                
                const excludeInput = await ask('\n🚫 Исключить слова (через запятую): ');
                const excludeWords = excludeInput ? excludeInput.split(',').map(w => w.trim()) : [];
                
                const filtered = filterVacancies(vacancies, excludeWords);
                console.log(`✅ После фильтрации: ${filtered.length} вакансий`);
                
                if (filtered.length === 0) {
                    console.log('⚠️ Нет вакансий для отклика');
                    continue;
                }
                
                const counter = new DailyCounter(80);
                const status = counter.getStatus();
                
                console.log('\n📊 СТАТИСТИКА:');
                console.log(`   Откликов сегодня: ${status.count}/${status.maxDaily}`);
                console.log(`   Осталось: ${status.remaining}`);
                
                if (status.count >= status.maxDaily) {
                    console.log('⚠️ Достигнут лимит откликов на сегодня');
                    logger.log('Достигнут лимит откликов на сегодня');
                    continue;
                }
                
                console.log('\n⚙️  НАСТРОЙКИ ОТКЛИКОВ:');
                const delayInput = await ask('⏱️  Задержка между откликами в секундах (по умолчанию 30): ');
                const delay = (parseInt(delayInput) || 30) * 1000;
                
                const randomDelayInput = await ask('🎲 Использовать случайную задержку? (y/n, по умолчанию y): ');
                const randomDelay = randomDelayInput.toLowerCase() !== 'n';
                
                const maxResponses = Math.min(filtered.length, status.remaining);
                console.log(`\n📊 Будет обработано: ${maxResponses} вакансий`);
                logger.log(`Будет обработано: ${maxResponses} вакансий`);
                
                const confirm = await ask('\n🚀 Запустить отклики? (y/n): ');
                if (confirm.toLowerCase() !== 'y') {
                    console.log('❌ Отменено');
                    continue;
                }
                
                console.log('\n' + '='.repeat(60));
                console.log('🚀 ЗАПУСК АВТОМАТИЧЕСКИХ ОТКЛИКОВ');
                console.log('='.repeat(60));
                logger.log('🚀 ЗАПУСК АВТОМАТИЧЕСКИХ ОТКЛИКОВ');
                
                // Сохраняем вакансии в лист ожидания
                filtered.slice(0, maxResponses).forEach(v => {
                    addToPending(v);
                });
                
                const results = await batchRespond(page, filtered.slice(0, maxResponses), resumeText, userPrompt, {
    delay: delay,
    randomDelay: randomDelay,
    maxResponses: maxResponses,
    useGemini: true,
    forceResponse: false,
    debug: false,
    // Добавляем колбэк для сохранения HTML
    onHtmlSave: async (page, url, reason, extra) => {
        return await logger.savePageHTML(page, url, reason, extra);
    },
    onSuccess: async (result, vacancy) => {
        addCompletedResponse({
            id: result.data?.id || Date.now().toString(),
            title: result.data?.title || vacancy.title,
            company: result.data?.company || vacancy.company,
            url: vacancy.url,
            timestamp: new Date().toISOString(),
            coverLetter: result.data?.coverLetter || '',
            status: 'completed'
        });
        removeFromPending(vacancy.url);
        logger.log(`✅ Успешный отклик: ${vacancy.title}`);
    },
    onError: async (error, vacancy) => {
        addError({
            message: error.message,
            type: error.type || 'response_error'
        }, {
            title: vacancy.title,
            company: vacancy.company,
            url: vacancy.url
        });
        removeFromPending(vacancy.url);
        logger.error(`❌ Ошибка отклика: ${vacancy.title}`, error);
    }
});
                
                for (let i = 0; i < results.success; i++) {
                    counter.increment();
                }
                
                console.log('\n' + '📊'.repeat(15));
                console.log('📊 ИТОГИ ОТКЛИКОВ');
                console.log('📊'.repeat(15));
                console.log(`✅ Успешно: ${results.success}`);
                console.log(`❌ Ошибок: ${results.failed}`);
                console.log(`⏭️  Пропущено: ${results.skipped || 0}`);
                console.log(`📁 Логи: ${PATHS.LOGS}`);
                console.log(`📁 HTML для анализа: ${PATHS.HTML_DEBUG}`);
                
                logger.log(`Итоги: успешно=${results.success}, ошибок=${results.failed}`);
                
                await pressEnter('\nНажми Enter чтобы продолжить...');
            }
        }
        
    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
        logger.error('Критическая ошибка', error);
        
        if (page && logger) {
            await logger.savePageHTML(page, page.url(), 'critical-error', {
                error: error.message
            });
        }
        
        addError(error, { title: 'Критическая ошибка', company: 'System', url: '' });
    } finally {
        rl.close();
        await browser.close();
        console.log('\n👋 Работа завершена');
        if (logger) logger.log('👋 Работа завершена');
    }
}

// Запуск
main().catch(console.error);