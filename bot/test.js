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

// 📂 ПУТЬ К ЕДИНОМУ ФАЙЛУ ДАННЫХ
const DATA_FILE = path.join(__dirname, 'bot-data.json');

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С ДАННЫМИ =====

/**
 * Загружает данные из bot-data.json
 */
function loadData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        // Возвращаем структуру по умолчанию
        return {
            lastUpdated: new Date().toISOString(),
            stats: {
                totalResponses: 0,
                successful: 0,
                failed: 0,
                skipped: 0,
                byDate: {}
            },
            pending: [],           // Вакансии в процессе
            completed: [],         // Успешные отклики
            errors: []            // Ошибки с деталями
        };
    }
}

/**
 * Сохраняет данные в bot-data.json
 */
function saveData(data) {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`💾 Данные сохранены в ${DATA_FILE}`);
}

/**
 * Добавляет запись об успешном отклике
 */
function addCompletedResponse(responseData) {
    const data = loadData();
    
    // Добавляем в историю
    data.completed.unshift(responseData); // Новые записи в начало
    
    // Обновляем статистику
    data.stats.totalResponses++;
    data.stats.successful++;
    
    // Обновляем статистику по дням
    const today = new Date().toISOString().split('T')[0];
    if (!data.stats.byDate[today]) {
        data.stats.byDate[today] = { success: 0, failed: 0, skipped: 0 };
    }
    data.stats.byDate[today].success++;
    
    // Ограничиваем историю последними 1000 записями
    if (data.completed.length > 1000) {
        data.completed = data.completed.slice(0, 1000);
    }
    
    saveData(data);
}

/**
 * Добавляет запись об ошибке
 */
function addError(errorData, vacancyInfo) {
    const data = loadData();
    
    const errorEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        vacancy: vacancyInfo,
        error: errorData.message || errorData,
        type: errorData.type || 'unknown'
    };
    
    data.errors.unshift(errorEntry);
    data.stats.totalResponses++;
    data.stats.failed++;
    
    // Обновляем статистику по дням
    const today = new Date().toISOString().split('T')[0];
    if (!data.stats.byDate[today]) {
        data.stats.byDate[today] = { success: 0, failed: 0, skipped: 0 };
    }
    data.stats.byDate[today].failed++;
    
    // Ограничиваем историю ошибок последними 500 записями
    if (data.errors.length > 500) {
        data.errors = data.errors.slice(0, 500);
    }
    
    saveData(data);
}

/**
 * Добавляет вакансию в лист ожидания
 */
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
    
    // Проверяем, нет ли уже в списке
    const exists = data.pending.some(p => p.url === vacancy.url);
    if (!exists) {
        data.pending.push(pendingEntry);
        saveData(data);
        console.log(`📌 Добавлено в ожидание: ${vacancy.title}`);
    }
}

/**
 * Удаляет вакансию из листа ожидания
 */
function removeFromPending(vacancyUrl) {
    const data = loadData();
    const originalLength = data.pending.length;
    data.pending = data.pending.filter(p => p.url !== vacancyUrl);
    
    if (originalLength !== data.pending.length) {
        saveData(data);
    }
}

/**
 * Получает все данные для фронта
 */
function getFrontendData() {
    const data = loadData();
    return {
        lastUpdated: data.lastUpdated,
        stats: data.stats,
        pending: data.pending,
        completed: data.completed.slice(0, 100), // Последние 100 для фронта
        errors: data.errors.slice(0, 50)          // Последние 50 ошибок
    };
}

// ===== ОСТАЛЬНОЙ КОД БЕЗ ИЗМЕНЕНИЙ =====

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
    rl.close();
    process.exit(0);
});

// ===== ОСНОВНАЯ ФУНКЦИЯ =====
async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 HH.RU АВТОМАТИЧЕСКИЙ БОТ ДЛЯ ОТКЛИКОВ');
    console.log('='.repeat(60));
    
    // Проверка API ключей
    console.log('\n🔑 ПРОВЕРКА API КЛЮЧЕЙ:');
    console.log(`   Gemini: ${process.env.GEMINI_API_KEY ? '✅ Есть' : '❌ Нет'}`);
    console.log(`   OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✅ Есть' : '❌ Нет'}`);
    console.log(`   Прокси: ${process.env.VITE_PROXY_URL ? '✅ Есть' : '❌ Нет'}`);
    
    if (!process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY) {
        console.log('❌ Нет ни одного API ключа!');
        rl.close();
        return;
    }
    
    console.log('✅ Настройки загружены');
    
    // Запуск браузера
    console.log('\n🚀 Запуск браузера...');
    const { browser, page } = await launchStealthBrowser();
    
    try {
        // Авторизация
        console.log('\n' + '='.repeat(60));
        console.log('🚀 АВТОРИЗАЦИЯ НА HH.RU');
        console.log('='.repeat(60));
        
        const authSuccess = await manualAuth(page, rl);
        
        if (!authSuccess) {
            console.log('❌ Не удалось авторизоваться');
            return;
        }
        
        console.log('✅ Успешная авторизация!');
        
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
                console.log(`   📅 Последнее обновление: ${data.lastUpdated}`);
                await pressEnter('\nНажми Enter чтобы продолжить...');
                continue;
            }
            
            if (choice === '3') {
                console.log('\n' + '='.repeat(60));
                console.log('🔐 ПРОВЕРКА АВТОРИЗАЦИИ');
                console.log('='.repeat(60));
                const isAuthed = await checkAuth(page);
                console.log(isAuthed ? '✅ Вы авторизованы' : '❌ Сессия не активна');
                await pressEnter('\nНажми Enter чтобы продолжить...');
                continue;
            }
            
            if (choice === '4') {
                console.log('\n' + '='.repeat(60));
                console.log('🚪 ВЫХОД ИЗ АККАУНТА');
                console.log('='.repeat(60));
                await logout(page);
                console.log('✅ Вы вышли из аккаунта');
                running = false;
                break;
            }
            
            if (choice === '1') {
                // РЕЖИМ ПОИСКА ВАКАНСИЙ (без изменений)
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
                const vacancies = await searchVacancies(page, query, {
                    maxPages: parseInt(maxPages) || 3,
                    delay: 2000
                });
                
                if (vacancies.length === 0) {
                    console.log('⚠️ Вакансии не найдены');
                    continue;
                }
                
                console.log(`✅ Найдено ${vacancies.length} вакансий`);
                
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
                    continue;
                }
                
                console.log('\n📤 Загрузка резюме...');
                const resumeText = await loadResumeFromPdf(pdfPath);
                console.log(`✅ Резюме загружено (${resumeText.length} символов)`);
                
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
                
                const vacancies = await searchVacancies(page, query, {
                    maxPages: parseInt(maxPages) || 3,
                    delay: 2000
                });
                
                if (vacancies.length === 0) {
                    console.log('⚠️ Вакансии не найдены');
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
                    continue;
                }
                
                console.log('\n⚙️  НАСТРОЙКИ ОТКЛИКОВ:');
                const delayInput = await ask('⏱️  Задержка между откликами в секундах (по умолчанию 30): ');
                const delay = (parseInt(delayInput) || 30) * 1000;
                
                const randomDelayInput = await ask('🎲 Использовать случайную задержку? (y/n, по умолчанию y): ');
                const randomDelay = randomDelayInput.toLowerCase() !== 'n';
                
                const maxResponses = Math.min(filtered.length, status.remaining);
                console.log(`\n📊 Будет обработано: ${maxResponses} вакансий`);
                
                const confirm = await ask('\n🚀 Запустить отклики? (y/n): ');
                if (confirm.toLowerCase() !== 'y') {
                    console.log('❌ Отменено');
                    continue;
                }
                
                console.log('\n' + '='.repeat(60));
                console.log('🚀 ЗАПУСК АВТОМАТИЧЕСКИХ ОТКЛИКОВ');
                console.log('='.repeat(60));
                
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
                    onSuccess: (result, vacancy) => {
                        // Сохраняем успешный отклик
                        addCompletedResponse({
                            id: result.data?.id || Date.now().toString(),
                            title: result.data?.title || vacancy.title,
                            company: result.data?.company || vacancy.company,
                            url: vacancy.url,
                            timestamp: new Date().toISOString(),
                            coverLetter: result.data?.coverLetter || '',
                            status: 'completed'
                        });
                        // Удаляем из листа ожидания
                        removeFromPending(vacancy.url);
                    },
                    onError: (error, vacancy) => {
                        // Сохраняем ошибку
                        addError(error, {
                            title: vacancy.title,
                            company: vacancy.company,
                            url: vacancy.url
                        });
                        // Удаляем из листа ожидания
                        removeFromPending(vacancy.url);
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
                
                await pressEnter('\nНажми Enter чтобы продолжить...');
            }
        }
        
    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
        addError(error, { title: 'Критическая ошибка', company: 'System', url: '' });
    } finally {
        rl.close();
        await browser.close();
        console.log('\n👋 Работа завершена');
    }
}

// Запуск
main().catch(console.error);