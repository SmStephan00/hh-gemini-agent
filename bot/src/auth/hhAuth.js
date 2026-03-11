import fs from 'fs';
import path from 'path';
import readline from 'readline';

const COOKIES_PATH = path.join(process.cwd(), 'hh_cookies.json');

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

async function pressEnter(message) {
    console.log(message);
    await askQuestion('⏎ Нажми Enter чтобы продолжить...');
}

/**
 * Проверка авторизации (по форме поиска)
 */
export async function checkAuth(page) {
    try {
        console.log('🔍 Проверка авторизации...');
        
        // Проверяем наличие формы поиска (есть только на главной)
        const searchForm = await page.$('form[action="/search/vacancy"]');
        if (searchForm) {
            console.log('✅ Найдена форма поиска - пользователь на главной');
            return true;
        }
        
        // Проверяем наличие аватарки (на всякий случай)
        const avatar = await page.$('[data-qa="mainmenu_myapplicants"]');
        if (avatar) {
            console.log('✅ Найдена аватарка');
            return true;
        }
        
        // Проверяем, что мы не на странице входа
        const url = page.url();
        if (url.includes('/login')) {
            console.log('❌ Всё ещё на странице входа');
            return false;
        }
        
        // Проверяем наличие кнопки "Создать резюме" (есть только у неавторизованных)
        const createResumeButton = await page.$('a[href*="resume/create"]');
        if (createResumeButton) {
            console.log('❌ Найдена кнопка "Создать резюме" - не авторизован');
            return false;
        }
        
        console.log('⚠️ Явных признаков неавторизации нет, считаем авторизованным');
        return true;
        
    } catch (error) {
        console.error('⚠️ Ошибка проверки авторизации:', error.message);
        return false;
    }
}

/**
 * Ручная авторизация на hh.ru (только ручной вход)
 */
export async function manualAuth(page) {
    try {
        console.log('🔑 Ручная авторизация на hh.ru...');
        
        // Проверяем сохранённую сессию
        if (fs.existsSync(COOKIES_PATH)) {
            try {
                const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
                await page.context().addCookies(cookies);
                console.log('📂 Загружена сохранённая сессия');
                
                await page.goto('https://hh.ru', { waitUntil: 'networkidle' });
                
                const isAuthed = await checkAuth(page);
                if (isAuthed) {
                    console.log('✅ Уже авторизованы');
                    return true;
                }
            } catch (e) {
                console.log('⚠️ Ошибка загрузки сессии, продолжаем...');
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('🔐 РУЧНАЯ АВТОРИЗАЦИЯ');
        console.log('='.repeat(50));
        console.log('1. Сейчас откроется страница hh.ru');
        console.log('2. Войди в аккаунт вручную (любым способом)');
        console.log('3. ПОСЛЕ входа вернись сюда и нажми Enter');
        console.log('='.repeat(50) + '\n');
        
        await pressEnter('🔄 Нажми Enter чтобы открыть hh.ru...');
        
        // Открываем главную страницу с увеличенным таймаутом
        console.log('⏳ Загружаем страницу...');
        await page.goto('https://hh.ru', { 
            waitUntil: 'networkidle', 
            timeout: 120000 
        });

        // Принудительно устанавливаем масштаб и стили
        await page.evaluate(() => {
            document.body.style.zoom = '1';
            document.body.style.transform = 'none';
            document.documentElement.style.zoom = '1';
            window.scrollTo(0, 0);
        });

        console.log('\n🌐 Страница открыта. Выполни вход вручную...');
        console.log('📝 Инструкция:');
        console.log('   1. Если нужно - введи телефон');
        console.log('   2. Если придет SMS - введи код');
        console.log('   3. После успешного входа нажми Enter в этой консоли');
        console.log('');
        
        // Ждём ручного входа
        await pressEnter('✅ После того как вошёл в аккаунт, нажми Enter');

        // Даём время на перезагрузку
        console.log('⏳ Ждём 5 секунд...');
        await page.waitForTimeout(5000);

        // Сохраняем скриншот для отладки
        await page.screenshot({ path: 'debug-after-login.png', fullPage: true });
        console.log('📸 Скриншот сохранён: debug-after-login.png');
        
        // Проверяем авторизацию
        const isAuthed = await checkAuth(page);
        
        if (isAuthed) {
            console.log('\n✅ Авторизация подтверждена!');
            
            // Сохраняем сессию
            try {
                const cookies = await page.context().cookies();
                fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
                console.log('💾 Сессия сохранена в файл');
            } catch (e) {
                console.log('⚠️ Не удалось сохранить сессию:', e.message);
            }
            
            return true;
        } else {
            console.log('\n❌ Не удалось подтвердить авторизацию');
            console.log('📸 Посмотри скриншот debug-after-login.png');
            console.log('Видно ли на нём, что ты авторизован?');
            
            const retry = await askQuestion('\nПопробовать снова? (y/n): ');
            if (retry.toLowerCase() === 'y') {
                return manualAuth(page);
            }
            return false;
        }
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        throw error;
    }
}

/**
 * Выход из аккаунта
 */
export async function logout(page) {
    try {
        await page.goto('https://hh.ru/account/logout', { waitUntil: 'networkidle' });
        if (fs.existsSync(COOKIES_PATH)) {
            fs.unlinkSync(COOKIES_PATH);
            console.log('🗑️ Сессия удалена');
        }
        console.log('✅ Выход выполнен');
    } catch (error) {
        console.error('❌ Ошибка выхода:', error.message);
    }
}