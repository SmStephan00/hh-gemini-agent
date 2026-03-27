import Header from '../../components/Header/Header'
import './Dashboard.css'
import { useEffect, useMemo, useState } from 'react'
import StatisticBar from './compnents/StatisticBar'

const DashBoard = () => {
    const API_URL = 'http://localhost:3001/api'

    const [loadSearch, setLoadSearch] = useState(false)
    const [searchResults, setSearchResults] = useState([])
    const [loadResponse, setLoadResponse] = useState(false)
    const [responseProgress, setResponseProgress] = useState(null)
    const [stats, setStats] = useState({
        totalResponses: 0,
        successful: 0,
        failed: 0,
        companies: []
    })
    const [dailyStats, setDailyStats] = useState([])
    const [settings, setSettings] = useState({
        jobTitle: '',
        city: '',
        salaryFrom: '',
        salaryTo: '',
        experience: '',
        schedule: [],
        employment: [],
        exception: '',
        creativity: 0.5,
        letterStyle: [],
        responseDelay: '',
        resumePath: '',  // ← исправлено
        autoStart: false,
        weekDays: [],
        startTime: '',
        endTime: '',
        name: '',
        email: '',
        telegram: '',
        notifications: []
    })

    // Загрузка настроек
    useEffect(() => {
        const saved = localStorage.getItem('botSettings')
        if (saved) {
            setSettings(JSON.parse(saved))
            console.log('📦 Загружено из localStorage')
        }
    }, [])

    // Загрузка статистики с сервера
    useEffect(() => {
        const loadStats = async () => {
            try {
                const response = await fetch(`${API_URL}/stats`)
                const data = await response.json()
                setStats(data)
            } catch (err) {
                console.error('Ошибка загрузки статистики:', err)
            }
        }
        loadStats()
    }, [])

    // Загрузка дневной статистики
    useEffect(() => {
        const loadDailyStats = async () => {
            try {
                const response = await fetch(`${API_URL}/stats/daily`)
                const data = await response.json()
                if (data.success) {
                    setDailyStats(data.daily.slice(-7))
                }
            } catch (err) {
                console.error('Ошибка загрузки дневной статистики:', err)
            }
        }
        loadDailyStats()
    }, [])

    const date = new Date()

    // Активность за неделю из дневной статистики
    const weekActivity = useMemo(() => {
        const last7Days = []
        const today = new Date()
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date()
            date.setDate(today.getDate() - i)
            const dateStr = date.toISOString().split('T')[0]
            const dayStat = dailyStats.find(d => d.date === dateStr)
            last7Days.push({
                date: dateStr.slice(5),
                count: dayStat ? dayStat.total : 0,
                success: dayStat ? dayStat.success : 0,
                failed: dayStat ? dayStat.failed : 0
            })
        }
        return last7Days
    }, [dailyStats])

    const handlerSearch = async () => {
        setLoadSearch(true)

        const searchParams = {
            jobTitle: settings.jobTitle,
            city: settings.city,
            salaryFrom: settings.salaryFrom,
            salaryTo: settings.salaryTo,
            experience: settings.experience,
            schedule: settings.schedule,
            employment: settings.employment,
            exception: settings.exception
        }

        Object.keys(searchParams).forEach(key => {
            const value = searchParams[key]
            if (value === undefined || value === null || value === '' || 
                (Array.isArray(value) && value.length === 0)) {
                delete searchParams[key]
            }
        })

        try {
            const response = await fetch(`${API_URL}/search/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: searchParams })
            })

            const results = await response.json()

            if (results.success) {
                console.log(`✅ Найдено ${results.count} вакансий`)
                setSearchResults(results.vacancies)
            } else {
                console.error('❌ Ошибка поиска:', results.error)
            }
        } catch (err) {
            console.error('❌ Ошибка сети:', err)
        } finally {
            setLoadSearch(false)
        }
    }

    const handleResponse = async () => {
        if (searchResults.length === 0) {
            alert('Сначала найдите вакансии')
            return
        }
        if (!settings.resumePath) {
            alert('Укажите путь к файлу резюме в настройках')
            return
        }

        setLoadResponse(true)
        setResponseProgress({ status: 'starting', message: 'Запуск откликов...' })

        try {
            const response = await fetch(`${API_URL}/response/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vacancies: searchResults,
                    resumePath: settings.resumePath,
                    userPrompt: '',
                    options: {
                        delay: 30000,
                        randomDelay: true,
                        maxResponses: 80,
                        useGemini: true
                    }
                })
            })

            const data = await response.json()
            
            if (data.success) {
                setResponseProgress({
                    status: 'success',
                    message: `✅ Успешно: ${data.results.success}, Ошибок: ${data.results.failed}`,
                    details: data.results.details
                })
                // Обновляем статистику после откликов
                const statsResponse = await fetch(`${API_URL}/stats`)
                const newStats = await statsResponse.json()
                setStats(newStats)
            } else {
                setResponseProgress({
                    status: 'error',
                    message: `❌ Ошибка: ${data.error}`
                })
            }
        } catch (err) {
            setResponseProgress({
                status: 'error',
                message: `❌ Ошибка сети: ${err.message}`
            })
        } finally {
            setLoadResponse(false)
        }
    }

    return (
        <>
            <div className="block__dashboard">
                <StatisticBar title={`Статистика за ${date.toISOString().split('T')[0]}`}>
                    <ul className='list__response'>
                        <li className='item__response'>
                            <p className='title__col'>Откликов</p>
                            <p>{stats.totalResponses}</p>
                        </li>
                        <li className='item__response'>
                            <p className='title__col'>Успешные</p>
                            <p>{stats.successful}</p>
                            <p>
                                {stats.totalResponses !== 0
                                    ? `${Math.round(stats.successful / stats.totalResponses * 100)}%`
                                    : '0%'}
                            </p>
                        </li>
                        <li className='item__response'>
                            <p className='title__col'>Ошибки</p>
                            <p>{stats.failed}</p>
                            <p>
                                {stats.totalResponses !== 0
                                    ? `${Math.round(stats.failed / stats.totalResponses * 100)}%`
                                    : '0%'}
                            </p>
                        </li>
                        <li className='item__response'>
                            <p className='title__col'>Компаний</p>
                            <p>{stats.companies.length}</p>
                        </li>
                    </ul>
                </StatisticBar>
                
                <StatisticBar title={'Активность за неделю'}>
                    <div className='content__activity'>
                        <div className='col__name__item'>
                            {weekActivity.map((item, i) => (
                                <p key={i} className='name__item'>{item.date}</p>
                            ))}
                        </div>
                        <div className='col__progressbar'>
                            {weekActivity.map((item, i) => {
                                const maxCount = Math.max(...weekActivity.map(w => w.count), 1)
                                const width = (item.count / maxCount) * 100
                                return (
                                    <div key={i} className='progressbar'>
                                        <span style={{ width: `${width}%` }} className='progresbar__item'></span>
                                    </div>
                                )
                            })}
                        </div>
                        <div className='col__procent'>
                            {weekActivity.map((item, i) => (
                                <p key={i} className='procent__item'>{item.count}</p>
                            ))}
                        </div>
                    </div>
                </StatisticBar>
                
                <StatisticBar title={'Лимиты AI'}>
                    <div className='content__status__ai'>
                        <div className='col__name__item'>
                            <p className='name__item'>Gemini</p>
                            <p className='name__item'>GPT-3.5</p>
                            <p className='name__item'>GPT-5</p>
                            <p className='name__item'>OpenRouter</p>
                        </div>
                        <div className='col__progressbar'>
                            <div className='progressbar'><span style={{ width: '45%' }} className='progresbar__item'></span></div>
                            <div className='progressbar'><span style={{ width: '78%' }} className='progresbar__item'></span></div>
                            <div className='progressbar'><span style={{ width: '23%' }} className='progresbar__item'></span></div>
                            <div className='progressbar'><span style={{ width: '12%' }} className='progresbar__item'></span></div>
                        </div>
                        <div className='col__procent'>
                            <p className='procent__item'>45%</p>
                            <p className='procent__item'>78%</p>
                            <p className='procent__item'>23%</p>
                            <p className='procent__item'>12%</p>
                        </div>
                    </div>
                </StatisticBar>
                
                <div className='box__button'>
                    <button 
                        className='button__fonctional' 
                        onClick={handlerSearch}
                        disabled={loadSearch}
                    >
                        {loadSearch ? 'Поиск...' : 'Поиск'}
                    </button>
                    <button 
                        className='button__fonctional' 
                        onClick={handleResponse}
                        disabled={loadResponse || searchResults.length === 0}
                    >
                        {loadResponse ? 'Отклик...' : 'Отклик'}
                    </button>
                    <button className='button__fonctional'>Настройки</button>
                </div>
                
                {responseProgress && (
                    <div className={`response-progress ${responseProgress.status}`}>
                        <p>{responseProgress.message}</p>
                        {responseProgress.details && (
                            <details>
                                <summary>Подробнее</summary>
                                <ul>
                                    {responseProgress.details.map((item, i) => (
                                        <li key={i}>
                                            {item.title} — {item.company} — 
                                            {item.status === 'success' ? '✅' : '❌'} {item.reason || ''}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </div>
                )}
                
                {searchResults.length > 0 && (
                    <div className="search-results">
                        <h3>Найденные вакансии:</h3>
                        <div className='vacancy-content'>
                            {searchResults.map((vacancy, index) => (
                                <div key={vacancy.id || index} className="vacancy-card">
                                    <h4>{vacancy.title}</h4>
                                    <p>Компания: {vacancy.company}</p>
                                    <p>Город: {vacancy.city}</p>
                                    <p>Зарплата: {vacancy.salary || 'не указана'}</p>
                                    <a href={vacancy.url} target="_blank" rel="noopener noreferrer">
                                        Перейти к вакансии
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}

export default DashBoard