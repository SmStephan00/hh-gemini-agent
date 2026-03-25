import {searchVacancies} from '../bot/src/search/vacancySearch'
import {launchStealthBrowser} from '../bot/src/browser/stealthLauncher'
const puppeteer = require('puppeteer')

class BotRunner {
    constructor(){
        this.browser = null
        this.page = null
    }

    init = async () => {
        if(this.browser === null){
            this.browser = await puppeteer.launch({
                headless: false, args: ["--user-data-dir=/Users/myusername/Library/Application Support/Google/Chrome/"],
                executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ignoreDefaultArgs: ["--enable-automation"]
            })
            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1920, height: 1080 });
            await page.goto('');
        }
    }

    runSearch = async (settings) => {
        await this.init()
        const query = []

        const vacancies = await searchVacancies(this.page, queryObjects, options)
        return vacancies
    }


}