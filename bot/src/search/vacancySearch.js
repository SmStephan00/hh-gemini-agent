export async function searchVacancies(page, query, options = {}) {
    try{
        console.log(`\n🔍 ПОИСК ВАКАНСИЙ: "${query}"`);
        const {
            area = null,
            salary = null,
            experience = null,     
            employment = null,     
            schedule = null,       
            maxPages = 3,          
            delay = 2000           
        } = options;

        let url = 'https://hh.ru/search/vacancy?'
        const params = new URLSearchParams();

        params.append('text',query)
        params.append('search_field','name')
        params.append('items_on_page', '20')

        if (area) params.append('area', area);
        if (salary) params.append('salary', salary);
        if (experience) params.append('experience', experience);
        if (employment) params.append('employment', employment);
        if (schedule) params.append('schedule', schedule);

        url += params.toString();

        console.log(`📡 URL: ${url}`);

        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }) 
        
        await page.waitForSelector('[data-qa="vacancy-serp__vacancy"]', { timeout: 10000 });

        const allVacancies = []

        for (let pageNum = 1; pageNum <= maxPages; pageNum++){
            console.log(`📄 Парсинг страницы ${pageNum}...`);

            const pageVacancies  = await page.evaluate(()=>{
                const items = []
                const cards = document.querySelectorAll('[data-qa="vacancy-serp__vacancy"]');

                cards.forEach(card=>{

                    const titleElement = card.querySelector('[data-qa="serp-item__title"]');
                    const title = titleElement?.textContent?.trim() || ''

                    const url = titleElement?.href || ''

                    const idMatch = url.match(/\/vacancy\/(\d+)/)
                    const id = idMatch ? idMatch[1] : ''

                    const companyElement = card.querySelector('[data-qa="vacancy-serp__vacancy-employer"]');
                    const company = companyElement?.textContent?.trim() || ''

                    const salaryElement = card.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]');
                    const salary = salaryElement?.textContent?.trim() || ''

                    const cityElement = card.querySelector('[data-qa="vacancy-serp__vacancy-address"]');
                    const city = cityElement?.textContent?.trim() || ''

                    const snippetElement = card.querySelector('[data-qa="vacancy-serp__vacancy_snippet_responsibility"]')
                    const snippet = snippetElement?.textContent?.trim() || ''

                    const requirementElement = card.querySelector('[data-qa="vacancy-serp__vacancy_snippet_requirement"]');
                    const requirement = requirementElement?.textContent?.trim() || '';

                    items.push({
                        id,
                        title,
                        url,
                        company,
                        salary,
                        city,
                        snippet,
                        requirement,
                        fullText: `${title} ${company} ${salary} ${snippet} ${requirement}`.trim()
                    });
                })
                return items
            })

            console.log(`   ✅ Найдено ${pageVacancies.length} вакансий`)
            allVacancies.push(...pageVacancies)

            if(pageNum<maxPages){
                const nextButton = await page.$('a[data-qa="pager-next"]');
                if(!nextButton){
                    console.log('   ⏹️ Дальше страниц нет');
                    break;
                }

                await nextButton.click()
                await page.waitForTimeout(delay)
                await page.waitForSelector('[data-qa="vacancy-serp__vacancy"]')
            }
        }
        console.log(`\n✅ ВСЕГО НАЙДЕНО: ${allVacancies.length} вакансий`);

        const uniqueVacancies = allVacancies.filter((v, i, a) => 
            a.findIndex(t => t.id === v.id) === i
        );

        if(uniqueVacancies.length < allVacancies.length){
            console.log(`   (удалено ${allVacancies.length - uniqueVacancies.length} дубликатов)`);
        }

        return uniqueVacancies
        
    }catch(err){
        console.error('❌ Ошибка поиска вакансий:', err.message);
        throw err;
    }
    
    
}

export function filterVacancies(vacancies, excludeWords = []) {
    if (excludeWords.length === 0) return vacancies;
    
    const filtered = vacancies.filter(vacancy => {
        const text = vacancy.fullText.toLowerCase();
        return !excludeWords.some(word => 
            text.includes(word.toLowerCase())
        );
    });
    
    console.log(`🔍 После фильтрации: ${filtered.length} вакансий`);
    return filtered;
}

export function sortVacancies(vacancies, sortBy = 'relevance'){
    const sorted = [...vacancies];

    switch(sortBy) {
        case 'salary':
            sorted.sort((a, b) => {
                const salaryA = extractSalary(a.salary);
                const salaryB = extractSalary(b.salary);
                return salaryB - salaryA;
            });
            break;
        case 'date':
            
            break;
        default:
            
            break;
    }

    return sorted;
}

function extractSalary(salaryStr) {
    if (!salaryStr) return 0;
    
    const numbers = salaryStr.match(/\d+/g);
    if (!numbers) return 0;
    
    return Math.max(...numbers.map(Number));
}