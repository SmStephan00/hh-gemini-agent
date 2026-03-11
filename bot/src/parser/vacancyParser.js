export async function parseVacancyPage(page) {
    try{
        console.log('📄 Парсинг страницы вакансии...')

        await page.waitForSelector('[data-qa="vacancy-title"]',{timeout:10000})
    
        const vacancyData = await page.evaluate(()=>{
            const title = document.querySelector('[data-qa="vacancy-title"]')?.textContent?.trim() || '';
    

        const company = document.querySelector('[data-qa="vacancy-company-name"]')?.textContent?.trim() || '';
    
        const salary = document.querySelector('[data-qa="vacancy-salary"]')?.textContent?.trim() || null;

        const description = document.querySelector('[data-qa="vacancy-description"]')?.textContent?.trim() || '';

        const skills = [];
            document.querySelectorAll('[data-qa="bloko-tag__text"]').forEach(el => {
                const skill = el.textContent?.trim();
                if (skill) skills.push(skill);
            });

        const requirements = [];
            document.querySelectorAll('.vacancy-description-list-item').forEach(el => {
                const text = el.textContent?.trim();
                if (text) requirements.push(text);
            });

            return{
                title,
                company,
                salary,
                description,
                skills,
                requirements,
                fullText: [title,company,salary,description,...skills,...requirements].join(' ')

            }
        
    })

    console.log(`✅ Вакансия "${vacancyData.title}" распарсена, ${vacancyData.fullText.length} символов`)

    return vacancyData

    }catch(err){
        console.error('❌ Ошибка парсинга вакансии:', err.message);
        throw err;
    }
}