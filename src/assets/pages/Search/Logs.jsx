import { useEffect, useState } from 'react'
import './Logs.css'
import FormBox from './components/FormBox'

const Logs = () => {
    const API_URL = 'http://localhost:3001/api'

    const [logs, setLogs] = useState([])
    const [filteredLogs, setFilteredLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedLog, setSelectedLog] = useState(null)
    const [filters, setFilters] = useState({
        status: '',
        dateFrom: '',
        dateTo: ''
    })
    const [pagination, setPagination] = useState({
        currentPage: 1,
        itemsPerPage: 10,
        totalPages: 1
    })

    // Загрузка логов
    useEffect(() => {
        loadLogs()
    }, [])

    const loadLogs = async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`${API_URL}/logs`)
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            
            const data = await response.json()
            
            // Проверяем, что data - это массив
            if (Array.isArray(data)) {
                setLogs(data)
            } else {
                console.warn('API вернул не массив:', data)
                setLogs([])
            }
        } catch (err) {
            console.error('Ошибка загрузки логов:', err)
            setError(err.message)
            setLogs([])
        } finally {
            setLoading(false)
        }
    }

    // Фильтрация и пагинация
    useEffect(() => {
        try {
            let filtered = Array.isArray(logs) ? [...logs] : []

            if (filters.status) {
                filtered = filtered.filter(log => {
                    if (filters.status === 'Ошибки') return log?.type === 'error'
                    if (filters.status === 'Предупреждения') return log?.type === 'warning'
                    if (filters.status === 'Инфо') return log?.type === 'info'
                    return true
                })
            }

            if (filters.dateFrom) {
                filtered = filtered.filter(log => {
                    if (!log?.timestamp) return true
                    const logDate = new Date(log.timestamp).toISOString().split('T')[0]
                    return logDate >= filters.dateFrom
                })
            }
            if (filters.dateTo) {
                filtered = filtered.filter(log => {
                    if (!log?.timestamp) return true
                    const logDate = new Date(log.timestamp).toISOString().split('T')[0]
                    return logDate <= filters.dateTo
                })
            }

            const totalPages = Math.ceil(filtered.length / pagination.itemsPerPage) || 1
            const start = (pagination.currentPage - 1) * pagination.itemsPerPage
            const paginated = filtered.slice(start, start + pagination.itemsPerPage)

            setFilteredLogs(paginated)
            setPagination(prev => ({ ...prev, totalPages }))
        } catch (err) {
            console.error('Ошибка фильтрации:', err)
            setFilteredLogs([])
        }
    }, [logs, filters, pagination.currentPage, pagination.itemsPerPage])

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }))
        setPagination(prev => ({ ...prev, currentPage: 1 }))
    }

    const handlePageChange = (page) => {
        setPagination(prev => ({ ...prev, currentPage: page }))
    }

    const getStatusIcon = (type) => {
        switch (type) {
            case 'error': return '🔴'
            case 'warning': return '🟡'
            case 'info': return '🔵'
            default: return '⚪'
        }
    }

    const getStatusText = (type) => {
        switch (type) {
            case 'error': return 'Ошибка'
            case 'warning': return 'Предупреждение'
            case 'info': return 'Информация'
            default: return ''
        }
    }

    const groupLogsByDay = (logs) => {
        const groups = {}
        logs.forEach(log => {
            if (!log?.timestamp) return
            const date = new Date(log.timestamp).toISOString().split('T')[0]
            if (!groups[date]) groups[date] = []
            groups[date].push(log)
        })
        return groups
    }

    const formatDate = (dateStr) => {
        const today = new Date().toISOString().split('T')[0]
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        
        if (dateStr === today) return 'Сегодня'
        if (dateStr === yesterday) return 'Вчера'
        
        const [year, month, day] = dateStr.split('-')
        return `${day}.${month}.${year}`
    }

    // Показываем ошибку
    if (error) {
        return (
            <div className="logs__box">
                <div className="error-container">
                    <p>❌ Ошибка загрузки логов: {error}</p>
                    <button onClick={loadLogs} className="button__fonctional">Повторить</button>
                </div>
            </div>
        )
    }

    return (
        <div className="logs__box">
            <FormBox title={'Фильтры'}>
                <form className="form__setings" onSubmit={(e) => e.preventDefault()}>
                    <div className="line">
                        <div className="input__line">
                            <label>Статус:</label>
                            <div className="input__container">
                                <select
                                    value={filters.status}
                                    onChange={(e) => handleFilterChange('status', e.target.value)}
                                >
                                    <option value="">Все</option>
                                    <option value="Ошибки">🔴 Ошибки</option>
                                    <option value="Предупреждения">🟡 Предупреждения</option>
                                    <option value="Инфо">🔵 Информация</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="line">
                        <div className="input__line">
                            <label>Дата:</label>
                            <div className="input__container">
                                <input
                                    value={filters.dateFrom}
                                    type="date"
                                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                                />
                                <span>-</span>
                                <input
                                    value={filters.dateTo}
                                    type="date"
                                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className='box__button'>
                            <button onClick={loadLogs} className='button__fonctional' type="button">Применить</button>
                        </div>
                    </div>
                </form>
            </FormBox>

            {loading ? (
                <div className="loading">Загрузка логов...</div>
            ) : filteredLogs.length === 0 ? (
                <div className="no-data">
                    <p>📭 Нет логов</p>
                    <p className="no-data-hint">Пока нет ни одной записи. Логи будут появляться здесь по мере работы бота.</p>
                </div>
            ) : (
                Object.entries(groupLogsByDay(filteredLogs)).map(([date, dayLogs]) => (
                    <FormBox key={date} title={formatDate(date)}>
                        {dayLogs.map((log, idx) => (
                            <div key={log?.id || idx} className={`log-item log-${log?.type || 'info'}`}>
                                <div 
                                    className="log-header" 
                                    onClick={() => setSelectedLog(selectedLog?.id === log?.id ? null : log)}
                                >
                                    <div className="log-time">
                                        {getStatusIcon(log?.type)} {log?.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--:--'}
                                    </div>
                                    <div className="log-title">
                                        <span className="log-status">{getStatusText(log?.type)}</span>
                                        <span className="log-message">{log?.message || 'Нет сообщения'}</span>
                                    </div>
                                    <div className="log-expand">
                                        {selectedLog?.id === log?.id ? '▲' : '▼'}
                                    </div>
                                </div>

                                {selectedLog?.id === log?.id && (
                                    <div className="log-details">
                                        {log?.details?.vacancy && (
                                            <div className="details-section">
                                                <h4>📋 Вакансия</h4>
                                                <p><strong>Название:</strong> {log.details.vacancy.title}</p>
                                                <p><strong>Компания:</strong> {log.details.vacancy.company}</p>
                                                {log.details.vacancy.url && (
                                                    <p><strong>URL:</strong> <a href={log.details.vacancy.url} target="_blank" rel="noopener noreferrer">Перейти к вакансии</a></p>
                                                )}
                                            </div>
                                        )}
                                        
                                        {log?.details?.error && (
                                            <div className="details-section">
                                                <h4>❌ Ошибка</h4>
                                                <p><strong>Сообщение:</strong> {log.details.error.message}</p>
                                                {log.details.error.stack && (
                                                    <>
                                                        <p><strong>Стек:</strong></p>
                                                        <pre className="error-stack">{log.details.error.stack}</pre>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {log?.details?.context && (
                                            <div className="details-section">
                                                <h4>ℹ️ Контекст</h4>
                                                <p><strong>URL страницы:</strong> {log.details.context.pageUrl}</p>
                                                <p><strong>Попытка:</strong> {log.details.context.attempt}</p>
                                            </div>
                                        )}

                                        {log?.details?.htmlFile && (
                                            <button className="button__fonctional" onClick={() => {
                                                window.open(`${API_URL}/logs/download/${log.details.htmlFile}`, '_blank')
                                            }}>
                                                📄 Сохранить HTML
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </FormBox>
                ))
            )}

            {filteredLogs.length > 0 && (
                <div className="form__box">
                    <div className="title">
                        <h2>Пагинация</h2>
                    </div>
                    <div className="pagination__settings">
                        <div className="input__line">
                            <label>Показывать по:</label>
                            <div className="input__container">
                                <select
                                    value={pagination.itemsPerPage}
                                    onChange={(e) => {
                                        setPagination(prev => ({
                                            ...prev,
                                            itemsPerPage: Number(e.target.value),
                                            currentPage: 1
                                        }))
                                    }}
                                >
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                        </div>
                        <div className="page__list">
                            {[...Array(pagination.totalPages)].map((_, i) => (
                                <span key={i}>
                                    <a
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            handlePageChange(i + 1)
                                        }}
                                        className={pagination.currentPage === i + 1 ? 'active' : ''}
                                    >
                                        {i + 1}
                                    </a>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Logs