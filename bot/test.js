import { launchStealthBrowser } from './src/browser/stealthLauncher.js';
import { manualAuth, checkAuth, logout } from './src/auth/hhAuth.js';
import { searchVacancies, filterVacancies, sortVacancies } from './src/search/vacancySearch.js';
import { autoRespond, batchRespond } from './src/responder/autoResponder.js';
import { loadResumeFromPdf } from './src/resume/pdfLoader.js';
import { DailyCounter } from './src/counter/dailyCounter.js';
import readline from 'readline';

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

async function main() {
    console.log('\n' + '='.repeat(50));
    console.log('🧪 ТЕСТ АВТОРИЗАЦИИ, ПОИСКА И ОТКЛИКОВ HH.RU');
    console.log('='.repeat(50));
    
    const { browser, page } = await launchStealthBrowser();
    
    try {
        // Авторизуемся
        const authSuccess = await manualAuth(page);
        
        if (!authSuccess) {
            console.log('❌ Не удалось авторизоваться');
            return;
        }
        
        console.log('\n✅ Ты в аккаунте!');
        
        // Выбираем режим
        console.log('\nВыберите режим:');
        console.log('1 - Просто проверить авторизацию');
        console.log('2 - Поиск вакансий');
        console.log('3 - Автоматические отклики на вакансии');
        
        const mode = await ask('Режим (1/2/3): ');
        
        if (mode === '2') {
            // Режим поиска вакансий
            const query = await ask('\n🔍 Поисковый запрос (например "frontend разработчик"): ');
            
            console.log('\n📋 Дополнительные параметры (Enter - пропустить):');
            const excludeInput = await ask('🚫 Исключить слова (через запятую): ');
            const maxPages = await ask('📄 Количество страниц (по умолчанию 3): ');
            
            const excludeWords = excludeInput ? excludeInput.split(',').map(w => w.trim()) : [];
            
            const vacancies = await searchVacancies(page, query, {
                maxPages: parseInt(maxPages) || 3,
                delay: 2000
            });
            
            if (vacancies.length === 0) {
                console.log('❌ Вакансии не найдены');
                return;
            }
            
            const filtered = filterVacancies(vacancies, excludeWords);
            
            console.log('\n' + '='.repeat(50));
            console.log('📋 ПЕРВЫЕ 10 ВАКАНСИЙ:');
            console.log('='.repeat(50));
            
            filtered.slice(0, 10).forEach((v, i) => {
                console.log(`\n${i + 1}. ${v.title}`);
                console.log(`   🏢 ${v.company}`);
                console.log(`   💰 ${v.salary || 'з/п не указана'}`);
                console.log(`   📍 ${v.city}`);
                console.log(`   🔗 ${v.url}`);
            });
            
            const fs = await import('fs');
            fs.writeFileSync('vacancies.json', JSON.stringify(filtered, null, 2));
            console.log(`\n💾 Все вакансии сохранены в vacancies.json`);
            
        } else if (mode === '3') {
            // Режим автоматических откликов
            console.log('\n' + '='.repeat(50));
            console.log('🤖 РЕЖИМ АВТОМАТИЧЕСКИХ ОТКЛИКОВ');
            console.log('='.repeat(50));
            
            // 1. Загружаем резюме
            const pdfPath = await ask('\n📄 Путь к PDF с резюме: ');
            const resumeText = await loadResumeFromPdf(pdfPath);
            console.log(`✅ Резюме загружено (${resumeText.length} символов)`);
            
            // 2. Дополнительные пожелания для писем
            const userPrompt = await ask('\n📝 Дополнительные пожелания к письму (Enter - пропустить): ');
            
            // 3. Поиск вакансий
            const query = await ask('\n🔍 Поисковый запрос для вакансий: ');
            const maxPages = await ask('📄 Количество страниц для поиска (по умолчанию 3): ');
            
            const vacancies = await searchVacancies(page, query, {
                maxPages: parseInt(maxPages) || 3,
                delay: 2000
            });
            
            if (vacancies.length === 0) {
                console.log('❌ Вакансии не найдены');
                return;
            }
            
            // 4. Фильтрация
            const excludeInput = await ask('\n🚫 Исключить слова (через запятую): ');
            const excludeWords = excludeInput ? excludeInput.split(',').map(w => w.trim()) : [];
            const filtered = filterVacancies(vacancies, excludeWords);
            
            console.log(`\n📊 После фильтрации: ${filtered.length} вакансий`);
            
            // 5. Счётчик откликов
            const counter = new DailyCounter(80);
            console.log(`\n📈 Откликов сегодня: ${counter.count}/${counter.maxDaily}`);
            
            if (counter.count >= counter.maxDaily) {
                console.log('⚠️ Достигнут лимит откликов на сегодня');
                return;
            }
            
            // 6. Параметры откликов
            console.log('\n⚙️  Настройки откликов:');
            const delayInput = await ask('⏱️  Задержка между откликами в секундах (по умолчанию 30): ');
            const delay = (parseInt(delayInput) || 30) * 1000;
            
            const randomDelayInput = await ask('🎲 Использовать случайную задержку? (y/n, по умолчанию y): ');
            const randomDelay = randomDelayInput.toLowerCase() !== 'n';
            
            // 7. Запускаем отклики
            console.log('\n🚀 НАЧАЛО АВТОМАТИЧЕСКИХ ОТКЛИКОВ');
            
            const results = await batchRespond(page, filtered, resumeText, userPrompt, {
                delay: delay,
                randomDelay: randomDelay,
                maxResponses: counter.maxDaily - counter.count,
                useGemini: true,
                forceResponse: false
            });
            
            // 8. Обновляем счётчик
            for (let i = 0; i < results.success; i++) {
                counter.increment();
            }
            
            // 9. Сохраняем результаты
            if (results.details.length > 0) {
                const fs = await import('fs');
                fs.writeFileSync('responses.json', JSON.stringify(results.details, null, 2));
                console.log(`\n💾 Детали откликов сохранены в responses.json`);
            }
        }
        
        // Действия после теста (для всех режимов)
        console.log('\nВыберите действие:');
        console.log('1 - Оставить браузер открытым');
        console.log('2 - Выйти из аккаунта');
        console.log('Enter - Закрыть браузер');
        
        const action = await ask('Ваш выбор (1/2/Enter): ');
        
        if (action === '2') {
            console.log('🚪 Выходим из аккаунта...');
            await logout(page);
            console.log('⏳ Ждём 3 секунды...');
            await page.waitForTimeout(3000);
        } else if (action === '1') {
            console.log('⏳ Браузер останется открытым 60 секунд...');
            await page.waitForTimeout(60000);
        } else {
            console.log('👋 Закрываем браузер...');
        }
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        rl.close();
        await browser.close();
        console.log('✅ Завершено');
    }
}

// Обработка Ctrl+C
process.on('SIGINT', async () => {
    console.log('\n\n⚠️ Прервано пользователем');
    rl.close();
    process.exit(0);
});

main();