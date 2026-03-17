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

// 🔥 СОЗДАЕМ ОДИН ГЛОБАЛЬНЫЙ READLINE
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});

// 🔥 Функция для вопросов (использует глобальный rl)
function ask(query) {
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            resolve(answer.trim());
        });
    });
}

// 🔥 Функция для ожидания Enter
async function pressEnter(message) {
    console.log(message);
    await ask('⏎ Нажми Enter чтобы продолжить...');
}

// 🔥 Обработка Ctrl+C
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
            console.log('0 - Выход');
            
            const choice = await ask('\n👉 Выберите действие (0-4): ');
            
            if (choice === '0') {
                console.log('\n👋 Завершение работы...');
                running = false;
                break;
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
                
                // Сохраняем результаты
                const filename = `vacancies-${Date.now()}.json`;
                fs.writeFileSync(filename, JSON.stringify(filtered, null, 2));
                console.log(`💾 Результаты сохранены в ${filename}`);
                
                // Показываем первые 10
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
                
                // Загружаем резюме
                console.log('\n📤 Загрузка резюме...');
                const resumeText = await loadResumeFromPdf(pdfPath);
                console.log(`✅ Резюме загружено (${resumeText.length} символов)`);
                
                // 2. Дополнительные пожелания
                const userPrompt = await ask('\n📝 Дополнительные пожелания к письму (Enter - пропустить): ');
                
                // 3. Поисковый запрос
                const query = await ask('\n🔍 Поисковый запрос для вакансий: ');
                
                if (!query) {
                    console.log('⚠️ Поисковый запрос не может быть пустым');
                    continue;
                }
                
                // 4. Параметры поиска
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
                
                // 5. Фильтрация
                const excludeInput = await ask('\n🚫 Исключить слова (через запятую): ');
                const excludeWords = excludeInput ? excludeInput.split(',').map(w => w.trim()) : [];
                
                const filtered = filterVacancies(vacancies, excludeWords);
                console.log(`✅ После фильтрации: ${filtered.length} вакансий`);
                
                if (filtered.length === 0) {
                    console.log('⚠️ Нет вакансий для отклика');
                    continue;
                }
                
                // 6. Счётчик откликов
                const counter = new DailyCounter(80);
                const status = counter.getStatus();
                
                console.log('\n📊 СТАТИСТИКА:');
                console.log(`   Откликов сегодня: ${status.count}/${status.maxDaily}`);
                console.log(`   Осталось: ${status.remaining}`);
                
                if (status.count >= status.maxDaily) {
                    console.log('⚠️ Достигнут лимит откликов на сегодня');
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
                    console.log('❌ Отменено');
                    continue;
                }
                
                // 8. ЗАПУСК ОТКЛИКОВ
                console.log('\n' + '='.repeat(60));
                console.log('🚀 ЗАПУСК АВТОМАТИЧЕСКИХ ОТКЛИКОВ');
                console.log('='.repeat(60));
                
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
                    console.log(`💾 Детали откликов сохранены в ${filename}`);
                }
                
                // 11. ИТОГИ
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
    } finally {
        rl.close();
        await browser.close();
        console.log('\n👋 Работа завершена');
    }
}

// Запуск
main().catch(console.error);