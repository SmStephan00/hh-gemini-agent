

import { useState } from 'react'
import useAppStore from '../../store/appStore'
import './Search.css'
import { getVacancyDetails, searchVacancies } from '../../services/api'
import { useVacancies } from '../../hooks/useVacancies'



const Search = () => {
    
    const {searchQuery, minScore, setSearchQuery, resumeText } = useAppStore()
    const [localQuery, setLocalQuery] = useState(searchQuery)

    const {
        vacancies, 
        loading, 
        analyzing,
        error, 
        search,
        analyzeAll,
        analysisResults,
    } = useVacancies()
    
    const handleSearch = () =>{
        setSearchQuery(localQuery)
        search(localQuery)
    }

    const handleAnalyze = async () =>{
        if(!resumeText){
            alert("Текст нужен")
            return
        }
        await analyzeAll(resumeText)
    }




    return(
        <div className="box__search">
            <h1>Поиск вакансий</h1>

            <div className='block__search'>
                <label className='text__serch'>
                    Что ищем?
                </label>
                <div className='form__serch'>
                    <input 
                        type="text"
                        value={localQuery}
                        onChange={(e)=>{ setLocalQuery(e.target.value)}}
                        className='input__serch'
                        placeholder='Вакансия'
                        onKeyPress={(e) => e.key === 'Enter'&&handleSearch()}
                    />
                    <button 
                        className='button__search'
                        onClick={handleSearch}
                        disabled={loading}
                    >
                        <p>{loading ? 'Поиск...' : 'Поиск'}</p>
                    </button>
                </div>
            </div>

            {vacancies.length > 0 && (
              <div className='analyze-section'>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className='button__analyze'
                >
                  {analyzing ? 'Анализ...' : 'Анализировать все вакансии'}
                </button>
              </div>
            )}

            <div className='box__info__serch'>
                <p>Текущие настройки</p>
                <ul className='list__info__serch'>
                    <li>Минимальный порог: {minScore}%</li>
                    <li>Резюме: {resumeText ? '✓ загружено' : '✗ не загружено'}</li>
                </ul>
            </div>

            {error && (
              <div className="error-message">
                Ошибка: {error}
              </div>
            )}

            {loading && <p>Загрузка...</p>}

            <div className='box__list__vacancy'>
                <h2>Список вакансий ({vacancies.length})</h2>
                <ul className='list__vacancy'>
                  {vacancies.map((vacancy) => (
                    <li key={vacancy.id} className='item__vacancy'>
                      <h3>{vacancy.title}</h3>
                      <p>Компания: {vacancy.company}</p>
                      <p>Зарплата: {vacancy.salary || 'не указана'}</p>
                      <p>Навыки: {vacancy.keySkills?.join(', ') || 'не указаны'}</p>
                      {/* Отображение результата анализа */}
                      {analysisResults[vacancy.id] !== undefined && (
                        <div className={`score-badge ${
                          analysisResults[vacancy.id] >= minScore ? 'good' : 'bad'
                        }`}>
                          Соответствие: {analysisResults[vacancy.id]}%
                          {analysisResults[vacancy.id] >= minScore && ' ✓'}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
            </div>
        </div>
    )
}

export default Search