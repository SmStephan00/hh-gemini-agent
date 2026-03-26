import { filterVacancies, searchVacancies } from '../bot/src/search/vacancySearch.js'
import { loadResumeFromPdf } from '../bot/src/resume/pdfLoader.js'
import { autoRespond } from '../bot/src/responder/autoResponder.js'
import { launchStealthBrowser, saveCookies } from '../bot/src/browser/stealthLauncher.js'
import puppeteer  from 'puppeteer'

export class BotRunner {
    constructor(){
        this.browser = null
        this.page = null
    }

    init = async () => {
        if(this.browser === null){
            const { browser, context, page } = await launchStealthBrowser()

            this.browser = browser
            this.context = context
            this.page = page
        }
    }

    runSearch = async (settings) => {
    await this.init()

    // Формируем query правильно
    let query = settings?.jobTitle || ''
    if (settings?.city && settings.city.trim() !== '') {
        query += ` ${settings.city}`
    }
    query = query.trim()

    if (!query) {
        throw new Error('Поисковый запрос пуст. Укажите должность или город')
    }
    
    const experienceMap = {
        'без опыта': 'noExperience',
        '1–3': 'between1And3',
        '3–6': 'between3And6',
        'более 6': 'moreThan6'
    }
    
    const options = {
        salary: settings?.salaryFrom ? parseInt(settings.salaryFrom) : null,
        experience: experienceMap[settings?.experience] || null,
        employment: settings?.employment?.length > 0 ? settings.employment.join(',') : null,
        schedule: settings?.schedule?.length > 0 ? settings.schedule.join(',') : null,
        maxPages: 8,
        delay: 2000,
    }

    Object.keys(options).forEach(key => {
        if (options[key] === null || options[key] === undefined) {
            delete options[key]
        }
    })

    let vacancies = await searchVacancies(this.page, query, options)

    if (settings?.exception) {
        const excludeWords = settings.exception.split(',').map(w => w.trim())
        vacancies = filterVacancies(vacancies, excludeWords)
    }

    return vacancies
}

    async respond(vacancyUrl, resumePath, userPrompt = '', options = {}) {
        await this.init()

        const resumeText = await loadResumeFromPdf(resumePath)
        
        const result = await autoRespond(
            this.page,
            vacancyUrl,
            resumeText,
            userPrompt,
            options
        )

        return result
    }

    async batchRespond(vacancies, resumePath, userPrompt = '', options = {}) {
        const {
            delay = 30000,
            randomDelay = true,
            maxResponses = 80,
            useGemini = true
        } = options

        const results ={
            total: vacancies.length,
            success: 0,
            failed : 0,
            details : [],
        }

        console.log(`\n🚀 ЗАПУСК ПАКЕТНОГО ОТКЛИКА`)
        console.log(`📊 Всего вакансий: ${results.total}`)

        for(let i = 0; i < vacancies.length; i++){
            if(results.success >= maxResponses){
                console.log(`\n⚠️ Достигнут лимит откликов (${maxResponses})`)
                break
            }

            console.log(`\n--- [${i+1}/${results.total}] ${vacancies[i].title} ---`)

            const responseResult = await this.respond(
                vacancies[i].url,
                resumePath,
                userPrompt,
                { useGemini }
            )
            
            if(responseResult.success){
                results.success +=1
                results.details.push({title: vacancies[i].title, company: vacancies[i].company, status: 'success'})
                console.log(`✅ Отклик успешен!`)
            }else{
                results.failed +=1 
                results.details.push({title: vacancies[i].title, company: vacancies[i].company, status: 'failed' ,reason: responseResult.reason || responseResult.error})
                console.log(`❌ Ошибка: ${responseResult.reason || responseResult.error}`)
            }

            if(i !== vacancies.length-1 && results.success !== maxResponses){
                let timeDelay = delay
                if(randomDelay){
                    timeDelay = delay + Math.floor(Math.random()*30001)   
                }
                await new Promise(resolve => setTimeout(resolve, timeDelay))
            }
            
        }

        console.log('\n' + '='.repeat(50))
        console.log('📊 ИТОГИ ОТКЛИКОВ')
        console.log('='.repeat(50))
        console.log(`✅ Успешно: ${results.success}`)
        console.log(`❌ Ошибок: ${results.failed}`)

        return results
    }

    

    closeBrowser = async () => {
        if (this.browser !== null) {
            // Сохраняем куки перед закрытием
            if (this.context) {
                await saveCookies(this.context)
            }

            await this.browser.close()
            this.browser = null
            this.context = null
            this.page = null
            console.log('✅ Браузер закрыт, куки сохранены')
        }
    }
}