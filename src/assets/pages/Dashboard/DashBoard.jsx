

import Header from '../../components/Header/Header'
import './Dashboard.css'
import botInfo from '../../../../bot/bot-data.json'
import { useMemo, useState } from 'react'
import StatisticBar from './compnents/StatisticBar'
const DashBoard = () => {

    const {loadSearch,setLoadSearch} = useState(false)
    
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
                                 return <p className='name__item'>{`${item}`}</p>
                            })}    
                        </div>
                        <div className='col__progressbar'>
                            {weekProgressbar.map((item)=>{
                                 return (
                                    <div className='progressbar'>
                                        <span style={{ width: `${item.length/80*100}%`}} className='progresbar__item'></span>
                                    </div>
                                 )
                            })}
                        </div>
                        <div className='col__procent'>
                        {weekProgressbar.map((item)=>{
                            return <p className='procent__item'>{`${Math.round(item.length/80*100)}%`}</p>
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
                    <button className='button__fonctional'>Поиск</button>
                    <button className='button__fonctional'>Отклик</button>
                    <button className='button__fonctional'>Настройки</button>
                </div>
            </div>
        </>
    )
}

export default DashBoard