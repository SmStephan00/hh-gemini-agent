import { chromium } from "playwright-extra";
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { generateFingerprint } from "./fingerprint.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIES_PATH = path.join(__dirname, '..', '..', 'hh_cookies.json');

chromium.use(StealthPlugin())

export async function launchStealthBrowser() {
    const { fingerprint } = generateFingerprint()
    
    console.log('🚀 Запуск невидимого браузера...')
    
    const screenWidth = fingerprint.screen.width || 1920;
    const screenHeight = fingerprint.screen.height || 1080;
    
    console.log(`📏 Размер экрана: ${screenWidth}x${screenHeight}`);

    const browser = await chromium.launch({
        headless: false,
        args: [
            `--window-size=${screenWidth},${screenHeight}`,
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-web-security',
            '--disable-features=BlockInsecurePrivateNetworkRequests',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--force-device-scale-factor=1',
            '--disable-features=TranslateUI',
            '--disable-features=BlinkGenPropertyTrees',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    })

    const context = await browser.newContext({
        viewport: {
            width: screenWidth,
            height: screenHeight
        },
        userAgent: fingerprint.navigator.userAgent,
        locale: 'ru-RU',
        timezoneId: 'Europe/Moscow',
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false
    })

    // 🔥 ЗАГРУЖАЕМ СОХРАНЁННЫЕ КУКИ
    if (fs.existsSync(COOKIES_PATH)) {
        try {
            const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'))
            await context.addCookies(cookies)
            console.log('🍪 Загружена сохранённая сессия')
        } catch (err) {
            console.log('⚠️ Ошибка загрузки кук:', err.message)
        }
    }

    const page = await context.newPage()

    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en'] });
        window.chrome = { runtime: {} };
    })
    
    console.log('✅ Невидимый браузер запущен')
    
    return { browser, context, page };
}

// 🔥 ФУНКЦИЯ ДЛЯ СОХРАНЕНИЯ КУК
export async function saveCookies(context) {
    try {
        const cookies = await context.cookies()
        fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2))
        console.log('🍪 Куки сохранены')
        return true
    } catch (err) {
        console.log('⚠️ Ошибка сохранения кук:', err.message)
        return false
    }
}