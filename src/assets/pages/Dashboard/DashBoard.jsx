

import Header from '../../components/Header/Header'
import './Dashboard.css'
import botInfo from '../../../../bot/bot-data.json'
import { useEffect, useMemo, useState } from 'react'
import StatisticBar from './compnents/StatisticBar'
const DashBoard = () => {
    const API_URL = 'http://localhost:3001/api'


    const [loadSearch, setLoadSearch] = useState(false)
    const [searchResults, setSearchResults] = useState([])

    const [loadResponse, setLoadResponse] = useState(false)
    const [responseProgress, setResponseProgress] = useState(false)

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
        resumeFile: null,
        autoStart: false,
        weekDays: [],
        startTime: '',
        endTime: '',
        name: '',
        email: '',
        telegram: '',
        notifications: []
    })

    useEffect(() => {
        const saved = localStorage.getItem('botSettings')
        if (saved) {
            setSettings(JSON.parse(saved))
            console.log('📦 Загружено из localStorage')
        } else {
            console.log('⚠️ Нет сохранённых настроек')
        }
    }, [])

    
    const company = new Set (botInfo.completed.map((item)=>{
        return item.company
    }))

    const date = new Date()

    const {dateWeek, weekProgressbar} = useMemo(()=>{
        const date = new Date()
        const dateWeek = []
        const weekProgressbar = []
        const statDay = [...botInfo.completed]

        for(let i=0; i<7; i++){
            dateWeek[i] = `${new Date(date.setDate(new Date().getDate() - i)).toISOString().slice(5, 10)}`

            weekProgressbar[i] = statDay.filter((item)=>{
                return item.timestamp.slice(0,10) == new Date(new Date().setDate(new Date().getDate() - i)).toISOString().slice(0, 10)
            })
             
        }
        return {dateWeek, weekProgressbar}
    },[botInfo.completed])

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

            if (value === undefined || 
                value === null || 
                value === '' || 
                (Array.isArray(value) && value.length === 0)) {
                delete searchParams[key]
            }
        })

        console.log('🔍 Отправляю поиск:', searchParams)

        try {
            const response = await fetch(`${API_URL}/search/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: searchParams })
            })

            const results = await response.json()
            console.log('Текущие настройки в state:', settings)

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

    const handleResponse = async () =>{
        if (searchResults.length === 0) {
            alert('Сначала найдите вакансии')
            return
        }
        if (!settings.resumePath) {
            alert('Укажите путь к файлу резюме в настройках')
            return
        }

        setLoadResponse(true)
        setResponseProgress({status: 'starting', message: 'Запуск откликов...' })

        try{
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

            console.log('📤 Отправляю запрос:', {
                vacancies: searchResults.length,
                resumePath: settings.resumePath,
                userPrompt: '',
                options: {
                    delay: 30000,
                    randomDelay: true,
                    maxResponses: 80,
                    useGemini: true
                }
            })            

            const data = await response.json()
            if (data.success) {
                setResponseProgress({
                    status: 'success',
                    message: `✅ Успешно: ${data.results.success}, Ошибок: ${data.results.failed}`,
                    details: data.results.details
                })
            } else {
                setResponseProgress({
                    status: 'error',
                    message: `❌ Ошибка: ${data.error}`
                })
            }


            
        }catch (err) {
            setResponseProgress({
                status: 'error',
                message: `❌ Ошибка сети: ${err.message}`
            })
        } finally {
            setLoadResponse(false)
        }
    }
    return(  
        <>
            <div className="block__dashboard">
                <StatisticBar title={`Статистика за ${date.toISOString().split('T')[0]}`} value={weekProgressbar}>
                    <ul className='list__response'>
                        <li className='item__response'>
                            <p className='title__col'>Откликов</p>
                            <p>{`${botInfo.stats.totalResponses}`}</p>
                             
                        </li>
                        <li className='item__response'>
                            <p className='title__col'>Успешные</p>
                            <p>{`${botInfo.stats.successful}`}</p>
                            <p>
                                {
                                    `${botInfo.stats.successful!==0
                                    ?Math.round(botInfo.stats.successful/botInfo.stats.totalResponses*100)
                                    :0}%`
                                }
                            </p>   
                        </li>
                        <li className='item__response'>
                            <p className='title__col'>Ошибки</p>
                            <p>{`${botInfo.stats.failed}`}</p>
                            <p>
                                {
                                    `${botInfo.stats.failed!==0?
                                    Math.round(botInfo.stats.failed/botInfo.stats.totalResponses*100)
                                    :0}%`
                                }
                            </p>   
                        </li>
                        <li className='item__response'>
                            <p className='title__col'>Компаний</p>
                            <p>{`${company.size}`}</p> 
                        </li>
                    </ul>
                </StatisticBar>
                <StatisticBar title={`активность за неделю`}>
                    <div className='content__activity'>
                        <div className='col__name__item'>
                            {dateWeek.map((item)=>{
                                return <p key={item} className='name__item'>{`${item}`}</p>
                            })}    
                        </div>
                        <div className='col__progressbar'>
                            {weekProgressbar.map((item,index)=>{
                                 return (
                                    <div key={index} className='progressbar'>
                                        <span style={{ width: `${item.length/80*100}%`}} className='progresbar__item'></span>
                                    </div>
                                 )
                            })}
                        </div>
                        <div className='col__procent'>
                        {weekProgressbar.map((item, index)=>{
                            return <p key={index} className='procent__item'>{`${Math.round(item.length/80*100)}%`}</p>
                        })}
                            
                        </div>
                    </div>
                </StatisticBar>
                <StatisticBar title={`Лимиты AI`} >
                    <div className='content__status__ai'>
                        <div className='col__name__item'>
                            <p className='name__item'>Gemini</p>
                            <p className='name__item'>GPT-3.5</p>
                            <p className='name__item'>GPT-5</p>
                            <p className='name__item'>OpenRouter</p>
                        </div>
                        <div className='col__progressbar'>
                            <div className='progressbar'>
                                <span style={{ width: `${12}%` }} className='progresbar__item'></span>
                            </div>
                            <div className='progressbar'>
                                <span style={{ width: `${12}%` }} className='progresbar__item'></span>
                            </div>
                            <div className='progressbar'>
                                <span style={{ width: `${12}%` }} className='progresbar__item'></span>
                            </div>
                            <div className='progressbar'>
                                <span style={{ width: `${12}%` }} className='progresbar__item'></span>
                            </div>
                        </div>
                        <div className='col__procent'>
                            <p className='procent__item'>{`${12}%`}</p>
                            <p className='procent__item'>{`${12}%`}</p>
                            <p className='procent__item'>{`${12}%`}</p>
                            <p className='procent__item'>{`${12}%`}</p>
                        </div>
                    </div>
                </StatisticBar>
                <div className='box__button'>
                    <button 
                        className='button__fonctional' 
                        onClick={() => handlerSearch()}
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
                {searchResults.length > 0 && (
                    <div className="search-results">
                        <h3>Найденные вакансии:</h3>
                        <div className='vacancy-contant'>
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