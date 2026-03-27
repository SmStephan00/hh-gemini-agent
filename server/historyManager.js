import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_PATH = path.join(__dirname, 'data')
const HISTORY_PATH = path.join(DATA_PATH, 'responses-stats.json')

export function saveResponseToHistory(vacancy, status, details = {}) {
    try {
        let history = []

        if (fs.existsSync(HISTORY_PATH)) {
            try {
                const data = fs.readFileSync(HISTORY_PATH, 'utf-8')
                history = JSON.parse(data)
            } catch (err) {
                console.log('⚠️ Ошибка чтения истории, создаём новую')
            }
        }

        const entry = {
            id: vacancy.id || Date.now().toString(),
            title: vacancy.title,
            company: vacancy.company,
            url: vacancy.url,
            salary: vacancy.salary || null,
            city: vacancy.city || null,
            skills: vacancy.skills || [],
            timestamp: new Date().toISOString(),
            status: status,
            reason: details.reason || null,
            coverLetter: details.coverLetter || null
        }

        history.unshift(entry)

        if (history.length > 1000) {
            history = history.slice(0, 1000)
        }

        fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2))
        console.log(`📝 Сохранён отклик: ${vacancy.title} — ${status}`)

        return true
    } catch (error) {
        console.error('❌ Ошибка сохранения истории:', error.message)
        return false
    }
}

export function getHistory() {
    try {
        if (!fs.existsSync(HISTORY_PATH)) {
            return []
        }
        const data = fs.readFileSync(HISTORY_PATH, 'utf-8')
        return JSON.parse(data)
    } catch (error) {
        console.error('❌ Ошибка чтения истории:', error.message)
        return []
    }
}

export function getDailyStats() {
    const history = getHistory()
    const daily = {}
    history.forEach(item => {
        const date = new Date(item.timestamp).toISOString().split('T')[0]
        if (!daily[date]) {
            daily[date] = { success: 0, failed: 0, skipped: 0, total: 0 }
        }
        daily[date][item.status]++
        daily[date].total++
    })
    return Object.entries(daily).map(([date, stats]) => ({
        date,
        ...stats
    })).sort((a, b) => a.date.localeCompare(b.date))
}