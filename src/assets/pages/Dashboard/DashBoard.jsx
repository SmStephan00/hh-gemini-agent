

import Header from '../../components/Header/Header'
import './Dashboard.css'
import botInfo from '../../../../bot/bot-data.json'
const DashBoard = () => {
    
    const company = new Set (botInfo.completed.map((item)=>{
        return item.company
    }))

    const date = new Date()

    const statDay = [...botInfo.completed]


    function filterStatDay(day){
        return statDay.filter((item)=>{
            return item.timestamp.slice(0,10) == new Date(new Date().setDate(new Date().getDate() - day)).toISOString().slice(0, 10)
        })

        
    }
    
    
    return(
        
        <>
        {console.log(filterStatDay(0).length)}
            <div className="block__dashboard">
                <div className='box__statistic'>
                    <div className='title'>
                        <h2>Статистика за {`${date.toISOString().split('T')[0]}`}</h2>
                    </div>
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
                   
                </div>
                <div className='box__activity__to__week'>
                    <div className='title'>
                        <h2>активность за неделю</h2>
                    </div>
                    <div className='content__activity'>
                        <div className='col__name__item'>
                            <p className='name__item'>{`${new Date(date.setDate(new Date().getDate() - 0)).toISOString().slice(5, 10)}`}</p>
                            <p className='name__item'>{`${new Date(date.setDate(new Date().getDate() - 1)).toISOString().slice(5, 10)}`}</p>
                            <p className='name__item'>{`${new Date(date.setDate(new Date().getDate() - 2)).toISOString().slice(5, 10)}`}</p>
                            <p className='name__item'>{`${new Date(date.setDate(new Date().getDate() - 3)).toISOString().slice(5, 10)}`}</p>
                            <p className='name__item'>{`${new Date(date.setDate(new Date().getDate() - 4)).toISOString().slice(5, 10)}`}</p>
                            <p className='name__item'>{`${new Date(date.setDate(new Date().getDate() - 5)).toISOString().slice(5, 10)}`}</p>
                            <p className='name__item'>{`${new Date(date.setDate(new Date().getDate() - 6)).toISOString().slice(5, 10)}`}</p>
                        </div>
                        <div className='col__progressbar'>
                            <div className='progressbar'>
                                <span style={{ width: `${filterStatDay(0).length/80*100}%`}} className='progresbar__item'></span>
                            </div> 
                            <div className='progressbar'>
                                <span style={{ width: `${filterStatDay(1).length/80*100}%` }} className='progresbar__item'></span>
                            </div> 
                            <div className='progressbar'>
                                <span style={{ width: `${filterStatDay(2).length/80*100}%` }} className='progresbar__item'></span>
                            </div> 
                            <div className='progressbar'>
                                <span style={{ width: `${filterStatDay(3).length/80*100}%` }} className='progresbar__item'></span>
                            </div> 
                            <div className='progressbar'>
                                <span style={{ width: `${filterStatDay(4).length/80*100}%` }} className='progresbar__item'></span>
                            </div> 
                            <div className='progressbar'>
                                <span style={{ width: `${filterStatDay(5).length/80*100}%` }} className='progresbar__item'></span>
                            </div> 
                            <div className='progressbar'>
                                <span style={{ width: `${filterStatDay(6).length/80*100}%` }} className='progresbar__item'></span>
                            </div> 
                        </div>
                        <div className='col__procent'>
                            <p className='procent__item'>{`${Math.round(filterStatDay(0).length/80*100)}%`}</p>
                            <p className='procent__item'>{`${Math.round(filterStatDay(1).length/80*100)}%`}</p>
                            <p className='procent__item'>{`${Math.round(filterStatDay(2).length/80*100)}%`}</p>
                            <p className='procent__item'>{`${Math.round(filterStatDay(3).length/80*100)}%`}</p>
                            <p className='procent__item'>{`${Math.round(filterStatDay(4).length/80*100)}%`}</p>
                            <p className='procent__item'>{`${Math.round(filterStatDay(5).length/80*100)}%`}</p>
                            <p className='procent__item'>{`${Math.round(filterStatDay(6).length/80*100)}%`}</p>
                        </div>
                    </div>
                    
                </div>
                <div className='box__status__ai'>
                    <div className='title'>
                        <h2>Лимиты AI</h2>
                    </div>
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
                </div>
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