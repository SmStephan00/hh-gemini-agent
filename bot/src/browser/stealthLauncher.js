import { chromium } from "playwright-extra";
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { generateFingerprint } from "./fingerprint.js";

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
            '--force-device-scale-factor=1',  // Принудительный масштаб
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
        deviceScaleFactor: 1,  // Фиксируем масштаб
        hasTouch: false,
        isMobile: false
    })

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