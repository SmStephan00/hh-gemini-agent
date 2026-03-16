// index.js - ГЛАВНЫЙ ФАЙЛ ДЛЯ ЗАПУСКА БОТА В КОНСОЛИ
import { launchStealthBrowser } from './src/browser/stealthLauncher.js';
import { manualAuth, checkAuth, logout } from './src/auth/hhAuth.js';
import { searchVacancies, filterVacancies, sortVacancies } from './src/search/vacancySearch.js';
import { autoRespond, batchRespond } from './src/responder/autoResponder.js';
import { loadResumeFromPdf } from './src/resume/pdfLoader.js';
import { DailyCounter } from './src/counter/dailyCounter.js';
import { generateCoverLetter } from './src/gemini/letterGenerator.js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function printHeader(title) {
    console.log('\n' + '='.repeat(60));
    console.log(`🚀 ${title}`);
    console.log('='.repeat(60));
}

function printSuccess(message) {
    console.log(`✅ ${message}`);
}

function printWarning(message) {
    console.log(`⚠️ ${message}`);
}

function printError(message) {
    console.log(`❌ ${message}`);
}

async function checkApiKeys() {
    const keys = {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        VITE_PROXY_URL: process.env.VITE_PROXY_URL
    };
    
    console.log('\n🔑 ПРОВЕРКА API КЛЮЧЕЙ:');
    console.log(`   Gemini: ${keys.GEMINI_API_KEY ? '✅ Есть' : '❌ Нет'}`);
    console.log(`   OpenRouter: ${keys.OPENROUTER_API_KEY ? '✅ Есть' : '❌ Нет'}`);
    console.log(`   Прокси: ${keys.VITE_PROXY_URL ? '✅ Есть' : '❌ Нет'}`);
    
    if (!keys.OPENROUTER_API_KEY && !keys.GEMINI_API_KEY) {
        printError('Нет ни одного API ключа!');
        return false;
    }
    
    return true;
}

async function main() {
    printHeader('HH.RU АВТОМАТИЧЕСКИЙ БОТ ДЛЯ ОТКЛИКОВ');
    
    // Проверяем API ключи
    const hasKeys = await checkApiKeys();
    if (!hasKeys) {
        printError('Добавьте ключи в .env файл');
        return;
    }
    
    printSuccess('Настройки загружены');
    
    // Запускаем браузер
    console.log('\n🚀 Запуск браузера...');
    const { browser, page } = await launchStealthBrowser();
    
    try {
        // Авторизация
        printHeader('АВТОРИЗАЦИЯ НА HH.RU');
        const authSuccess = await manualAuth(page);
        
        if (!authSuccess) {
            printError('Не удалось авторизоваться');
            return;
        }
        
        printSuccess('Успешная авторизация!');
        
        // Главное меню
        while (true) {
            printHeader('ГЛАВНОЕ МЕНЮ');
            console.log('1 - Поиск вакансий');
            console.log('2 - Автоматические отклики');
            console.log('3 - Проверить авторизацию');
            console.log('4 - Выйти из аккаунта');
            console.log('0 - Выход');
            
            const choice = await ask('\n👉 Выберите действие (0-4): ');
            
            if (choice === '0') {
                printSuccess('Завершение работы...');
                break;
            }
            
            if (choice === '3') {
                printHeader('ПРОВЕРКА АВТОРИЗАЦИИ');
                const isAuthed = await checkAuth(page);
                console.log(isAuthed ? '✅ Вы авторизованы' : '❌ Сессия не активна');
                await ask('\nНажми Enter чтобы продолжить...');
                continue;
            }
            
            if (choice === '4') {
                printHeader('ВЫХОД ИЗ АККАУНТА');
                await logout(page);
                printSuccess('Вы вышли из аккаунта');
                break;
            }
            
            if (choice === '1') {
                // РЕЖИМ ПОИСКА ВАКАНСИЙ
                printHeader('ПОИСК ВАКАНСИЙ');
                
                const query = await ask('🔍 Поисковый запрос (например "frontend разработчик"): ');
                
                if (!query) {
                    printWarning('Поисковый запрос не может быть пустым');
                    continue;
                }
                
                console.log('\n📋 Дополнительные параметры (Enter - пропустить):');
                const excludeInput = await ask('🚫 Исключить слова (через запятую): ');
                const maxPages = await ask('📄 Количество страниц (по умолчанию 3): ');
                
                const excludeWords = excludeInput ? excludeInput.split(',').map(w => w.trim()) : [];
                
                printHeader('ПОИСК...');
                const vacancies = await searchVacancies(page, query, {
                    maxPages: parseInt(maxPages) || 3,
                    delay: 2000
                });
                
                if (vacancies.length === 0) {
                    printWarning('Вакансии не найдены');
                    continue;
                }
                
                printSuccess(`Найдено ${vacancies.length} вакансий`);
                
                const filtered = filterVacancies(vacancies, excludeWords);
                
                if (filtered.length < vacancies.length) {
                    printSuccess(`После фильтрации: ${filtered.length} вакансий`);
                }
                
                // Сохраняем результаты
                const filename = `vacancies-${Date.now()}.json`;
                fs.writeFileSync(filename, JSON.stringify(filtered, null, 2));
                printSuccess(`Результаты сохранены в ${filename}`);
                
                // Показываем первые 10
                console.log('\n📋 ПЕРВЫЕ 10 ВАКАНСИЙ:');
                console.log('-'.repeat(60));
                
                filtered.slice(0, 10).forEach((v, i) => {
                    console.log(`\n${i + 1}. ${v.title}`);
                    console.log(`   🏢 ${v.company}`);
                    console.log(`   💰 ${v.salary || 'з/п не указана'}`);
                    console.log(`   📍 ${v.city}`);
                });
                
                await ask('\nНажми Enter чтобы продолжить...');
            }
            
            if (choice === '2') {
                // РЕЖИМ АВТОМАТИЧЕСКИХ ОТКЛИКОВ
                printHeader('АВТОМАТИЧЕСКИЕ ОТКЛИКИ');
                
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
                    printError('Файл не найден');
                    continue;
                }
                
                // Загружаем резюме
                console.log('\n📤 Загрузка резюме...');
                const resumeText = await loadResumeFromPdf(pdfPath);
                printSuccess(`Резюме загружено (${resumeText.length} символов)`);
                
                // 2. Дополнительные пожелания
                const userPrompt = await ask('\n📝 Дополнительные пожелания к письму (Enter - пропустить): ');
                
                // 3. Поисковый запрос
                const query = await ask('\n🔍 Поисковый запрос для вакансий: ');
                
                if (!query) {
                    printWarning('Поисковый запрос не может быть пустым');
                    continue;
                }
                
                // 4. Параметры поиска
                const maxPages = await ask('📄 Количество страниц для поиска (по умолчанию 3): ');
                
                printHeader('ПОИСК ВАКАНСИЙ');
                const vacancies = await searchVacancies(page, query, {
                    maxPages: parseInt(maxPages) || 3,
                    delay: 2000
                });
                
                if (vacancies.length === 0) {
                    printWarning('Вакансии не найдены');
                    continue;
                }
                
                printSuccess(`Найдено ${vacancies.length} вакансий`);
                
                // 5. Фильтрация
                const excludeInput = await ask('\n🚫 Исключить слова (через запятую): ');
                const excludeWords = excludeInput ? excludeInput.split(',').map(w => w.trim()) : [];
                
                const filtered = filterVacancies(vacancies, excludeWords);
                printSuccess(`После фильтрации: ${filtered.length} вакансий`);
                
                if (filtered.length === 0) {
                    printWarning('Нет вакансий для отклика');
                    continue;
                }
                
                // 6. Счётчик откликов
                const counter = new DailyCounter(80);
                const status = counter.getStatus();
                
                console.log('\n📊 СТАТИСТИКА:');
                console.log(`   Откликов сегодня: ${status.count}/${status.maxDaily}`);
                console.log(`   Осталось: ${status.remaining}`);
                
                if (status.count >= status.maxDaily) {
                    printWarning('Достигнут лимит откликов на сегодня');
                    continue;
                }
                
                // 7. Настройки откликов
                console.log('\n⚙️  НАСТРОЙКИ ОТКЛИКОВ:');
                const delayInput = await ask('⏱️  Задержка между откликами в секундах (по умолчанию 30): ');
                const delay = (parseInt(delayInput) || 30) * 1000;
                
                const randomDelayInput = await ask('🎲 Использовать случайную задержку? (y/n, по умолчанию y): ');
                const randomDelay = randomDelayInput.toLowerCase() !== 'n';
                
                const maxResponses = Math.min(filtered.length, status.remaining);
                console.log(`\n📊 Будет обработано: ${maxResponses} вакансий`);
                
                const confirm = await ask('\n🚀 Запустить отклики? (y/n): ');
                if (confirm.toLowerCase() !== 'y') {
                    console.log('Отменено');
                    continue;
                }
                
                // 8. ЗАПУСК ОТКЛИКОВ
                printHeader('ЗАПУСК АВТОМАТИЧЕСКИХ ОТКЛИКОВ');
                
                const results = await batchRespond(page, filtered.slice(0, maxResponses), resumeText, userPrompt, {
                    delay: delay,
                    randomDelay: randomDelay,
                    maxResponses: maxResponses,
                    useGemini: true,
                    forceResponse: false,
                    debug: false
                });
                
                // 9. Обновляем счётчик
                for (let i = 0; i < results.success; i++) {
                    counter.increment();
                }
                
                // 10. Сохраняем результаты
                if (results.details && results.details.length > 0) {
                    const filename = `responses-${Date.now()}.json`;
                    fs.writeFileSync(filename, JSON.stringify(results.details, null, 2));
                    printSuccess(`Детали откликов сохранены в ${filename}`);
                }
                
                // 11. ИТОГИ
                console.log('\n' + '📊'.repeat(15));
                console.log('📊 ИТОГИ ОТКЛИКОВ');
                console.log('📊'.repeat(15));
                console.log(`✅ Успешно: ${results.success}`);
                console.log(`❌ Ошибок: ${results.failed}`);
                console.log(`⏭️  Пропущено: ${results.skipped || 0}`);
                
                await ask('\nНажми Enter чтобы продолжить...');
            }
        }
        
    } catch (error) {
        printError(`Ошибка: ${error.message}`);
        console.log(error);
    } finally {
        rl.close();
        await browser.close();
        console.log('\n👋 Работа завершена');
    }
}

// Обработка Ctrl+C
process.on('SIGINT', async () => {
    console.log('\n\n⚠️ Прервано пользователем');
    rl.close();
    process.exit(0);
});

// Запуск
main();