import useAppStore from '../../store/appStore'

function Settings() {
  const { 
    minScore, 
    setMinScore, 
    searchQuery, 
    setSearchQuery, 
    resumeText,
    setResumeText,
    resetSettings 
  } = useAppStore()
  
  return (

    
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Настройки</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Поисковый запрос
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Например: frontend разработчик"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Минимальный процент соответствия: {minScore}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Текст резюме
          </label>
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows="6"
            placeholder="Вставьте текст вашего резюме..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Этот текст будет использоваться для анализа соответствия вакансиям
          </p>
        </div>
        
        <button
          onClick={resetSettings}
          className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
        >
          Сбросить настройки
        </button>
      </div>
      
      <div className="mt-4 p-4 bg-blue-50 rounded-md">
        <h3 className="font-semibold mb-2">Текущие значения:</h3>
        <p>Запрос: {searchQuery || '(не задан)'}</p>
        <p>Минимальный порог: {minScore}%</p>
        <p>Резюме: {resumeText ? `${resumeText.substring(0, 50)}...` : '(не задано)'}</p>
      </div>
    </div>
  )
}

export default Settings