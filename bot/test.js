import { launchStealthBrowser } from './src/browser/stealthLauncher.js';
import { manualAuth, logout } from './src/auth/hhAuth.js';
import readline from 'readline';

// Создаём интерфейс readline один раз
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});

// Функция для вопроса с обещанием
function ask(query) {
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            resolve(answer.trim().toLowerCase());
        });
    });
}

async function main() {
    console.log('\n' + '='.repeat(50));
    console.log('🧪 ТЕСТ АВТОРИЗАЦИИ HH.RU');
    console.log('='.repeat(50));
    
    const { browser, page } = await launchStealthBrowser();
    
    try {
        const success = await manualAuth(page);
        
        if (success) {
            console.log('\n✅ Ты в аккаунте!');
            
            // Простой выбор действия
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
        }
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        // Закрываем readline и браузер
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