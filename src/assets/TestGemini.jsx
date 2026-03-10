import { useState } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'

const TestGemini = () => {
    const [result, setResult] = useState('')
    const [loading, setLoading] = useState(false)

    const testGemini = async () => {
        setLoading(true)
        try {
            const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
            
            const prompt = "Ответь одним числом: сколько будет 2+2?"
            const result = await model.generateContent(prompt)
            const response = await result.response
            const text = response.text()
            
            setResult(`Успех! Ответ: ${text}`)
            console.log('✅ Gemini работает:', text)
        } catch (error) {
            setResult(`Ошибка: ${error.message}`)
            console.error('❌ Gemini ошибка:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px' }}>
            <h2>Тест Gemini API</h2>
            <button 
                onClick={testGemini} 
                disabled={loading}
                style={{ padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none' }}
            >
                {loading ? 'Тестирую...' : 'Проверить Gemini'}
            </button>
            {result && (
                <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0' }}>
                    {result}
                </div>
            )}
        </div>
    )
}

export default TestGemini