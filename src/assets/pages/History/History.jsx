import { useEffect, useState } from "react";
import FormBox from "./components/FormBox";
import './Histrory.css'

const History = () => {
    const API_URL = 'http://localhost:3001/api'

    const [history, setHistory] = useState([])
    const [filteredHistory, setFilteredHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedVacancy, setSelectedVacancy] = useState(null)
    const [filters, setFilters] = useState({
        search: '',
        company: '',
        status: '',
        dateFrom: '',
        dateTo: ''
    })
    const [pagination, setPagination] = useState({
        currentPage: 1,
        itemsPerPage: 10,
        totalPages: 1
    })

    useEffect(() => {
        loadHistory()
    }, [])

    const loadHistory = async () => {
        setLoading(true)
        try {
            const response = await fetch(`${API_URL}/history`)
            const data = await response.json()
            setHistory(data.completed || [])
        } catch (err) {
            console.error('Ошибка:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        let filtered = [...history]

        if (filters.search) {
            filtered = filtered.filter(item =>
                item.title?.toLowerCase().includes(filters.search.toLowerCase())
            )
        }

        if (filters.company) {
            filtered = filtered.filter(item =>
                item.company?.toLowerCase().includes(filters.company.toLowerCase())
            )
        }

        if (filters.status) {
            filtered = filtered.filter(item => {
                if (filters.status === 'Успешно') return item?.status === 'completed'
                if (filters.status === 'Ошибка') return item?.status === 'failed'
                if (filters.status === 'Пропущено') return item?.skipped === true
                return true
            })
        }

        if (filters.dateFrom) {
            filtered = filtered.filter(item =>
                new Date(item.timestamp).toISOString().split('T')[0] >= filters.dateFrom
            )
        }
        if (filters.dateTo) {
            filtered = filtered.filter(item =>
                new Date(item.timestamp).toISOString().split('T')[0] <= filters.dateTo
            )
        }

        const totalPages = Math.ceil(filtered.length / pagination.itemsPerPage) || 1
        const start = (pagination.currentPage - 1) * pagination.itemsPerPage
        const paginated = filtered.slice(start, start + pagination.itemsPerPage)

        setFilteredHistory(paginated)
        setPagination(prev => ({ ...prev, totalPages }))
    }, [history, filters, pagination.currentPage, pagination.itemsPerPage])

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }))
        setPagination(prev => ({ ...prev, currentPage: 1 }))
    }

    const handlePageChange = (page) => {
        setPagination(prev => ({ ...prev, currentPage: page }))
    }

    const getStatusBadge = (item) => {
        if (item.status === 'completed') return { text: '✅ Успешно', class: 'success' }
        if (item.status === 'failed') return { text: '❌ Ошибка', class: 'failed' }
        return { text: '⏭️ Пропущено', class: 'skipped' }
    }

    const openModal = (item) => {
        setSelectedVacancy(item)
    }

    const closeModal = () => {
        setSelectedVacancy(null)
    }

    return (
        <>
            <div className="history__box">
                <FormBox title={'Поиск'}>
                    <form className="form__setings">
                        <div className="line">
                            <div className="input__line">
                                <label>Поиск:</label>
                                <div className="input__container">
                                    <input
                                        value={filters.search}
                                        type="text"
                                        placeholder="Название вакансии"
                                        onChange={(e) => handleFilterChange('search', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="input__line">
                                <label>Компания:</label>
                                <div className="input__container">
                                    <input
                                        value={filters.company}
                                        type="text"
                                        placeholder="Название компании"
                                        onChange={(e) => handleFilterChange('company', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="input__line creative">
                                <label>Статус:</label>
                                <div className="input__container">
                                    <select
                                        value={filters.status}
                                        onChange={(e) => handleFilterChange('status', e.target.value)}
                                    >
                                        <option value="">Все</option>
                                        <option value="Успешно">Успешно</option>
                                        <option value="Ошибка">Ошибка</option>
                                        <option value="Пропущено">Пропущено</option>
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
                                <button onClick={loadHistory} className='button__fonctional'>Применить</button>
                            </div>
                        </div>
                    </form>
                </FormBox>

                <FormBox title={'Отклики'}>
                    {loading ? (
                        <div className="loading">Загрузка...</div>
                    ) : filteredHistory.length === 0 ? (
                        <div className="no-data">Нет откликов</div>
                    ) : (
                        filteredHistory.map((item) => {
                            const status = getStatusBadge(item)
                            return (
                                <div key={item.id} className="card" onClick={() => openModal(item)}>
                                    <div className="card__index">
                                        <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text__card">
                                        <strong>{item.title}</strong>
                                    </div>
                                    <div className="text__card">
                                        {item.company}
                                    </div>
                                    <div className="text__card">
                                        <span className={`status-badge ${status.class}`}>
                                            {status.text}
                                        </span>
                                    </div>
                                    <div className="text__card">
                                        <button 
                                            className="view-letter-btn"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                openModal(item)
                                            }}
                                        >
                                            📄 Подробнее
                                        </button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </FormBox>

                {filteredHistory.length > 0 && (
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

            
            {selectedVacancy && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Детали отклика</h2>
                            <button className="modal-close" onClick={closeModal}>✕</button>
                        </div>
                        
                        <div className="modal-content">
                           
                            <div className="info-section">
                                <h3>Вакансия</h3>
                                <p><strong>Название:</strong> {selectedVacancy.title}</p>
                                <p><strong>Компания:</strong> {selectedVacancy.company}</p>
                                <p><strong>Ссылка:</strong> <a href={selectedVacancy.url} target="_blank" rel="noopener noreferrer">Перейти к вакансии</a></p>
                                <p><strong>Дата отклика:</strong> {new Date(selectedVacancy.timestamp).toLocaleString()}</p>
                                <p><strong>Статус:</strong> <span className={`status-badge ${selectedVacancy.status === 'completed' ? 'success' : 'failed'}`}>
                                    {selectedVacancy.status === 'completed' ? '✅ Успешно' : '❌ Ошибка'}
                                </span></p>
                            </div>

                            {selectedVacancy.salary && (
                                <div className="info-section">
                                    <h3>Зарплата</h3>
                                    <p><strong>Ожидание:</strong> {selectedVacancy.salary}</p>
                                </div>
                            )}

                            {selectedVacancy.city && (
                                <div className="info-section">
                                    <h3>Локация</h3>
                                    <p><strong>Город:</strong> {selectedVacancy.city}</p>
                                </div>
                            )}

                            {selectedVacancy.skills && selectedVacancy.skills.length > 0 && (
                                <div className="info-section">
                                    <h3>Ключевые навыки</h3>
                                    <div className="skills-list">
                                        {selectedVacancy.skills.map((skill, i) => (
                                            <span key={i} className="skill-tag">{skill}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {selectedVacancy.requirements && selectedVacancy.requirements.length > 0 && (
                                <div className="info-section">
                                    <h3>Требования</h3>
                                    <ul>
                                        {selectedVacancy.requirements.map((req, i) => (
                                            <li key={i}>{req}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                        
                            <div className="info-section">
                                <h3>Сопроводительное письмо</h3>
                                <pre className="cover-letter">{selectedVacancy.coverLetter || 'Письмо не сохранено'}</pre>
                            </div>


                            <div className="info-section">
                                <h3>Дополнительно</h3>
                                <p><strong>ID вакансии:</strong> {selectedVacancy.id}</p>
                                {selectedVacancy.reason && (
                                    <p><strong>Причина ошибки:</strong> <span className="error-reason">{selectedVacancy.reason}</span></p>
                                )}
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="close-btn" onClick={closeModal}>Закрыть</button>
                            <button className="retry-btn" onClick={() => {
                                alert('Функция повторного отклика в разработке')
                                closeModal()
                            }}>Повторить отклик</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default History;