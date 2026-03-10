// src/services/api.js

// Имитация задержки сети
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Моковые данные
const mockVacancies = [
  {
    id: '1',
    title: 'Frontend Developer (React)',
    company: 'TechCorp',
    salary: 'от 150 000 до 250 000 ₽',
    description: 'Разработка интерфейсов на React, TypeScript. Опыт от 2 лет.',
    keySkills: ['React', 'TypeScript', 'Redux'],
    publishedAt: '2026-03-09'
  },
  {
    id: '2',
    title: 'JavaScript Developer',
    company: 'WebStudio',
    salary: 'от 120 000 ₽',
    description: 'Пишем на чистом JS, без фреймворков. Важно знание DOM API.',
    keySkills: ['JavaScript', 'HTML', 'CSS'],
    publishedAt: '2026-03-08'
  },
  {
    id: '3',
    title: 'Fullstack Developer (Node.js + React)',
    company: 'SoftSolutions',
    salary: 'до 300 000 ₽',
    description: 'Fullstack разработка: React на фронте, Node.js на бэке.',
    keySkills: ['React', 'Node.js', 'MongoDB'],
    publishedAt: '2026-03-07'
  }
]

export const searchVacancies = async (query) =>{
    console.log(`Поиск ${query}`)
    await delay(1000)

    const filtered = mockVacancies.filter(v=>
        v.title.toLowerCase().includes(query.toLowerCase())||
        v.company.toLowerCase().includes(query.toLowerCase())
    )

    

    return filtered
}

export const getVacancyDetails = async (id) => {
  console.log(`📄 Загрузка деталей вакансии: ${id}`)
  await delay(500)
  
  const vacancy = mockVacancies.find(v => v.id === id)
  if (!vacancy) throw new Error('Вакансия не найдена')
  
  return vacancy
}

