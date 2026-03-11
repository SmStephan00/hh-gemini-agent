import {generateCoverLetter} from '../gemini/letterGenerator.js'
import { parseVacancyPage } from '../parser/vacancyParser.js';

export async function autoRespond(page, vacancyUrl, resumeText, userPrompt = '', options = {}) {
    try{
        console.log(`\n📝 ОТКЛИК НА ВАКАНСИЮ: ${vacancyUrl}`)

        const {
            minScore = 0,
            useGemini = true,
            forceResponce = false,
            debug = false,
        }= options

        await page.goto(vacancyUrl, { waitUntil: 'networkidle' })

        const vacancyData = await parseVacancyPage(page)
        console.log(`📋 Вакансия: ${vacancyData.title} в ${vacancyData.company}`)

        const responseButton = await page.$('[data-qa="vacancy-response-button"]')
        if(!responseButton){
            console.log('⚠️ Кнопка отклика не найдена')
            return {success:false,reson:'no_response_button'}
        }

        const alreadyResponded = await page.$('[data-qa="vacancy-response-success-message"]')
        if(alreadyResponded){
            console.log('⚠️ Уже откликались на эту вакансию')
            return { success: false, reason: 'already_responded' }
        }

        let coverLetter = ''

        if(useGemini){
            console.log('🤖 Генерация сопроводительного письма...')
            coverLetter = await generateCoverLetter(vacancyData, resumeText, userPrompt)
            console.log('📨 Письмо сгенерировано')
        }

        await responseButton.click()

        await page.waitForTimeout(5000)

        const letterFiled = await page.$('[data-qa="response-letter"]')
        if(letterFiled){
            if(coverLetter){
                await letterFiled.fill(coverLetter)
                console.log('✍️ Письмо вставлено')
            }else{
                console.log('⚠️ Поле для письма есть, но письмо не сгенерировано')
                if(!forceResponce){
                    await closeModal(page)
                    return { success: false, reason: 'letter_required' }
                }
            }
        }

        const testBlock = await page.$('[data-qa="response-test"]')
        if(testBlock){
            console.log('⚠️ Обнаружен тест работодателя, пропускаем')
            await closeModal(page)
            return {success:false, reason: 'test_required'}
        }

        const submitButton = await page.$('[data-qa="response-submit"]')
        if(!submitButton){
            console.log('⚠️ Кнопка отправки не найдена')
            await closeModal(page)
            return{ success: false, reason: 'no_submit_button' }
        }

        await submitButton.click()

        try{
            await page.waitForSelector('[data-qa="response-success-message"]', { timeout: 5000 })
            console.log('✅ Отклик успешно отправлен!');

            const responseInfo = {
                id: vacancyData.id,
                title: vacancyData.title,
                company: vacancyData.company,
                url: vacancyUrl,
                timestamp: new Date().toISOString(),
                coverLetter: coverLetter ? coverLetter.substring(0, 100) + '...' : null
            };

            return { success: true, data: responseInfo }
        }catch(e){
            console.log('⚠️ Не удалось подтвердить отправку')
            return { success: false, reason: 'no_confirmation' }
        }
    }catch (error) {
        console.error('❌ Ошибка отклика:', error.message)
        return { success: false, reason: 'error', error: error.message }
    }
}

async function closeModal(page) {
    try {
        const closeButton = await page.$('[data-qa="modal-close"]');
        if (closeButton) {
            await closeButton.click();
            await page.waitForTimeout(1000);
        }
    } catch (e) {
        // Игнорируем ошибки закрытия
    }
}

export async function batchRespond(page, vacancies, resumeText, userPrompt = '', options = {}) {
    const {
        delay = 30000,           // задержка между откликами (30 секунд)
        randomDelay = true,       // случайная задержка
        maxResponses = 80,        // максимум откликов
        ...otherOptions
    } = options;
    
    console.log(`\n🚀 ЗАПУСК ПАКЕТНОГО ОТКЛИКА`);
    console.log(`📊 Всего вакансий: ${vacancies.length}`);
    console.log(`⏱️  Задержка: ${delay/1000} сек ${randomDelay ? '(рандомная)' : ''}`)
    
    const results = {
        total: vacancies.length,
        success: 0,
        failed: 0,
        skipped: 0,
        details: []
    };
    
    for (let i = 0; i < vacancies.length; i++) {
        if (results.success >= maxResponses) {
            console.log(`\n⚠️ Достигнут лимит откликов (${maxResponses})`)
            break;
        }
        
        const vacancy = vacancies[i];
        console.log(`\n--- [${i+1}/${vacancies.length}] ${vacancy.title} ---`)
        
        const result = await autoRespond(page, vacancy.url, resumeText, userPrompt, otherOptions)
        
        if (result.success) {
            results.success++
            results.details.push(result.data)
        } else {
            results.failed++
        }
        
        // Пауза между откликами (кроме последнего)
        if (i < vacancies.length - 1 && results.success < maxResponses) {
            let pauseTime = delay
            if (randomDelay) {
                pauseTime = delay + Math.random() * 60000 // +0..60 секунд
            }
            console.log(`⏳ Пауза ${Math.round(pauseTime/1000)} сек...`)
            await new Promise(resolve => setTimeout(resolve, pauseTime))
        }
    }
    
    results.skipped = vacancies.length - results.success - results.failed
    
    console.log('\n' + '='.repeat(50))
    console.log('📊 ИТОГИ ОТКЛИКОВ')
    console.log('='.repeat(50))
    console.log(`✅ Успешно: ${results.success}`)
    console.log(`❌ Ошибок: ${results.failed}`)
    console.log(`⏭️  Пропущено: ${results.skipped}`)
    console.log('='.repeat(50))
    
    return results;
}