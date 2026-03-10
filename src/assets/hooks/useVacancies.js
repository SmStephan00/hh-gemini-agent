import { useState } from "react"
import { searchVacancies } from "../services/api"
import { analyzeVacancy } from "../services/gemini"  // ← ВАЖНО: импортируем

export const useVacancies = () => {
    const [vacancies, setVacancies] = useState([])
    const [loading, setLoading] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [error, setError] = useState(null)
    const [selectedVacancy, setSelectedVacancy] = useState(null)
    const [analysisResults, setAnalysisResults] = useState({})
    
    const search = async (query) => {
        setLoading(true)
        setError(null)

        try {
            const results = await searchVacancies(query)
            setVacancies(results)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const analyzeAll = async (resumeText) => {
        console.log('🚀 Начинаем анализ всех вакансий')
        setAnalyzing(true)
        const results = {}

        for (const vacancy of vacancies) {
            console.log(`🔍 Анализ вакансии ${vacancy.id}: ${vacancy.title}`)
            try {
                const score = await analyzeVacancy(vacancy, resumeText)
                console.log(`✅ Результат для ${vacancy.id}: ${score}`)
                results[vacancy.id] = score
            } catch (err) {
                console.log('❌ Ошибка анализа:', vacancy.id, err)
                results[vacancy.id] = 0
            }    
        }

        console.log('📊 Итоговые результаты:', results)
        setAnalysisResults(results)
        setAnalyzing(false)
        return results
    }
    
    const loadDetails = async (id) => {
        setLoading(true)
        setError(null)

        try {
            const details = await getVacancyDetails(id)
            setSelectedVacancy(details)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return {
        vacancies,
        loading,
        analyzing,
        error,
        selectedVacancy,
        analysisResults,
        search,
        analyzeAll,
        loadDetails
    }
}