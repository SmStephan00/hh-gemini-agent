import { useEffect, useReducer } from "react"
import FormBox from "./components/FormBox"
import './Setting.css'



function Settings() {
  

  const initialState = {
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
  }
  
  const settingsReducer = (state, action) =>{
      switch (action.type) {
        case 'SET_FIELD':
          return { ...state, [action.field]: action.value }

        case 'SET_CHECKBOX_GROUP':
          const current = state[action.field]
          const updated = current.includes(action.value)
            ? current.filter(v => v !== action.value)
            : [...current, action.value]
          return { ...state, [action.field]: updated }

        case 'RESET':
          return initialState

        case 'LOAD_SAVED':
          return { ...state, ...action.payload }

        default:
          return state
      }
  }

  
  const [settings, dispatch] = useReducer(settingsReducer, initialState)

  const handlerChange = (field, value) => {
    dispatch({type: 'SET_FIELD', field, value})
  }

  const handlerCheckBox = (field, value) => {
    dispatch({type: 'SET_CHECKBOX_GROUP',field,value})
  }

  const handleSave = () => {
    localStorage.setItem('botSettings',JSON.stringify(settings))
  }

  const handleReset = ()=>{
    dispatch({type:'RESET'})
  }

  useEffect(() => {
    const saved = localStorage.getItem('botSettings')
    if (saved) {
      dispatch({ type: 'LOAD_SAVED', payload: JSON.parse(saved) })
    }
  }, [])
  


 return (
  <>
    <div className="block__setings">
      <FormBox title={'ОСНОВНЫЕ НАСТРОЙКИ'}>
        <form className="form__setings" action="">
          <div className="input__line">
            <label htmlFor="JobTitle">Должность:</label>
            <div className="input__container">
              <input 
                value={settings.jobTitle} 
                id='JobTitle' 
                type="text" 
                onChange={(e) => handlerChange('jobTitle', e.target.value)}
              />
            </div>
          </div>
            
          <div className="input__line">
            <label htmlFor="City">Город:</label>
            <div className="input__container">
              <input 
                value={settings.city}  
                id='City' 
                type="text" 
                onChange={(e) => handlerChange('city', e.target.value)}
              />
            </div>
          </div>

          <div className="input__line salary">
            <label htmlFor="Salary">Зарплата:</label>
            <div className="input__container">
              <input 
                value={settings.salaryFrom}  
                id='SalaryFrom' 
                type="text" 
                onChange={(e) => handlerChange('salaryFrom', e.target.value)}
              />
              <span>-</span>
              <input 
                value={settings.salaryTo} 
                id='SalaryTo' 
                type="text" 
                onChange={(e) => handlerChange('salaryTo', e.target.value)}
              />
              <span>₽</span>
            </div>
          </div>

          <div className="input__line">
            <label htmlFor="Experience">Опыт:</label>
            <div className="input__container">
              <input 
                value={settings.experience} 
                id='Experience' 
                list="ExperienceList" 
                type="list"
                onChange={(e) => handlerChange('experience', e.target.value)}
              />
              <datalist id="ExperienceList">
                <option value="без опыта"></option>
                <option value="1–3"></option>
                <option value="3–6"></option>
                <option value="более 6"></option>
              </datalist>
            </div>
          </div>

          <div className="input__line">
            <label>График:</label>
            <div className="input__container">
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.schedule.includes('Удаленно')}
                  onChange={() => handlerCheckBox('schedule', 'Удаленно')}
                />
                <span>Удаленно</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.schedule.includes('В офисе')}
                  onChange={() => handlerCheckBox('schedule', 'В офисе')}
                />
                <span>В офисе</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.schedule.includes('Гибрид')}
                  onChange={() => handlerCheckBox('schedule', 'Гибрид')}
                />
                <span>Гибрид</span>
              </div>
            </div>
          </div>

          <div className="input__line">
            <label>Занятость:</label>
            <div className="input__container">
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.employment.includes('Полная')}
                  onChange={() => handlerCheckBox('employment', 'Полная')}
                />
                <span>Полная</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.employment.includes('Частичная')}
                  onChange={() => handlerCheckBox('employment', 'Частичная')}
                />
                <span>Частичная</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.employment.includes('Стажировка')}
                  onChange={() => handlerCheckBox('employment', 'Стажировка')}
                />
                <span>Стажировка</span>
              </div>
            </div>
          </div>

          <div className="input__line">
            <label htmlFor="Exception">Исключить:</label>
            <div className="input__container">
              <input 
                value={settings.exception} 
                id='Exception' 
                type="text" 
                onChange={(e) => handlerChange('exception', e.target.value)}
              />
            </div>
          </div>
        </form>
      </FormBox>
      <FormBox title={'НАСТРОЙКА ПИСЬМА'}>
        <form className="form__setings" action="">
          <div className="input__line creative">
            <label htmlFor="Creative">Креативность:</label>
            <div className="input__container">
              <input 
                value={settings.creativity} 
                id='Creative' 
                type="range" 
                min="0" 
                max="1" 
                step="0.1"
                onChange={(e) => handlerChange('creativity', parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="input__line">
            <label>Стиль:</label>
            <div className="input__container">
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.letterStyle.includes('официальный')}
                  onChange={() => handlerCheckBox('letterStyle', 'официальный')}
                />
                <span>официальный</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.letterStyle.includes('дружеский')}
                  onChange={() => handlerCheckBox('letterStyle', 'дружеский')}
                />
                <span>дружеский</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.letterStyle.includes('креативный')}
                  onChange={() => handlerCheckBox('letterStyle', 'креативный')}
                />
                <span>креативный</span>
              </div>
            </div>
          </div>
        </form>
      </FormBox>
      <FormBox title={'НАСТРОЙКИ ОТКЛИКА'}>
        <form className="form__setings" action="">
          <div className="input__line creative">
            <label htmlFor="choice">Пауза между откликами:</label>
            <div className="input__container">
              <input 
                value={settings.responseDelay} 
                id='choice' 
                list="choiceList" 
                type="list"
                onChange={(e) => handlerChange('responseDelay', e.target.value)}
              />
              <datalist id="choiceList">
                <option value="3 секунды"></option>
                <option value="5 секунд"></option>
                <option value="10 секунд"></option>
              </datalist>
            </div>
          </div>

          <div className="input__line">
            <label htmlFor="Resume">Резюме:</label>
            <div className="input__container">
              <input 
                id='Resume'
                type="file"
                onChange={(e) => handlerChange('resumeFile', e.target.files[0])}
              />
            </div>
          </div>
        </form>
      </FormBox>
      <FormBox title={'РАСПИСАНИЕ'}>
        <form className="form__setings" action="">
          <div className="input__line">
            <label htmlFor="Auto">Автозапуск:</label>
            <div className="input__container">
              <input 
                id='Auto'
                type="checkbox"
                checked={settings.autoStart}
                onChange={(e) => handlerChange('autoStart', e.target.checked)}
              />
            </div>
          </div>

          <div className="input__line">
            <label>Дни недели:</label>
            <div className="input__container">
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.weekDays.includes('Пн')}
                  onChange={() => handlerCheckBox('weekDays', 'Пн')}
                />
                <span>Пн</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.weekDays.includes('Вт')}
                  onChange={() => handlerCheckBox('weekDays', 'Вт')}
                />
                <span>Вт</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.weekDays.includes('Ср')}
                  onChange={() => handlerCheckBox('weekDays', 'Ср')}
                />
                <span>Ср</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.weekDays.includes('Чт')}
                  onChange={() => handlerCheckBox('weekDays', 'Чт')}
                />
                <span>Чт</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.weekDays.includes('Пт')}
                  onChange={() => handlerCheckBox('weekDays', 'Пт')}
                />
                <span>Пт</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.weekDays.includes('Сб')}
                  onChange={() => handlerCheckBox('weekDays', 'Сб')}
                />
                <span>Сб</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.weekDays.includes('Вс')}
                  onChange={() => handlerCheckBox('weekDays', 'Вс')}
                />
                <span>Вс</span>
              </div>
            </div> 
          </div>

          <div className="input__line">
            <label htmlFor="time">Время:</label>
            <div className="input__container">
              <input 
                value={settings.startTime} 
                id='startTime'
                type="time"
                onChange={(e) => handlerChange('startTime', e.target.value)}
              />
              <input 
                value={settings.endTime} 
                id='endTime'
                type="time"
                onChange={(e) => handlerChange('endTime', e.target.value)}
              />
            </div>
          </div>
        </form>
      </FormBox>
      <FormBox title={'ПРОФИЛЬ'}>
        <form className="form__setings" action="">
          <div className="input__line">
            <label htmlFor="Name">Имя:</label>
            <div className="input__container">
              <input 
                value={settings.name}  
                id='Name' 
                type="text" 
                onChange={(e) => handlerChange('name', e.target.value)}
              />
            </div>
          </div>

          <div className="input__line">
            <label htmlFor="Email">Mail:</label>
            <div className="input__container">
              <input 
                value={settings.email} 
                id='Email' 
                type="email" 
                onChange={(e) => handlerChange('email', e.target.value)}
              />
            </div>
          </div>

          <div className="input__line">
            <label htmlFor="Telegram">Telegram:</label>
            <div className="input__container">
              <input 
                value={settings.telegram} 
                id='Telegram' 
                type="text"
                onChange={(e) => handlerChange('telegram', e.target.value)}
              />
            </div>
          </div>

          <div className="input__line">
            <label>Уведомления:</label>
            <div className="input__container">
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.notifications.includes('Telegram')}
                  onChange={() => handlerCheckBox('notifications', 'Telegram')}
                />
                <span>Telegram</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.notifications.includes('Email')}
                  onChange={() => handlerCheckBox('notifications', 'Email')}
                />
                <span>Email</span>
              </div>
              <div className="checkbox__line">
                <input 
                  type="checkbox"
                  checked={settings.notifications.includes('Выкл')}
                  onChange={() => handlerCheckBox('notifications', 'Выкл')}
                />
                <span>Выкл</span>
              </div>
            </div>
          </div>
        </form>
      </FormBox>

      <div className='box__button'>
          <button onClick={handleSave} className='button__fonctional'>Сохранить настройки</button>
          <button onClick={handleReset} className='button__fonctional'>Сбросить</button>
      </div>

      {/* КНОПКИ СОХРАНЕНИЯ */}
      <div className="settings-actions">
       
      </div>
    </div>
  </>
)
}

export default Settings