// server/logger.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_PATH = path.join(__dirname, 'data')
const LOGS_PATH = path.join(DATA_PATH, 'logs.json')

export function saveLog(type, message, details = {}) {
    try {
        let logs = []
        
        if (fs.existsSync(LOGS_PATH)) {
            try {
                const data = fs.readFileSync(LOGS_PATH, 'utf-8')
                logs = JSON.parse(data)
            } catch (err) {
                console.log('⚠️ Ошибка чтения логов, создаём новый файл')
            }
        }
        
        const logEntry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            type: type, // 'info', 'warning', 'error'
            message: message,
            details: details
        }
        
        logs.unshift(logEntry)
        
        if (logs.length > 1000) {
            logs = logs.slice(0, 1000)
        }
        
        fs.writeFileSync(LOGS_PATH, JSON.stringify(logs, null, 2))
        console.log(`📝 Лог сохранён: ${type} - ${message}`)
        return true
    } catch (err) {
        console.error('❌ Ошибка сохранения лога:', err.message)
        return false
    }
}

export function getLogs() {
    try {
        if (!fs.existsSync(LOGS_PATH)) {
            return []
        }
        const data = fs.readFileSync(LOGS_PATH, 'utf-8')
        return JSON.parse(data)
    } catch (err) {
        console.error('❌ Ошибка чтения логов:', err.message)
        return []
    }
}

export function clearLogs() {
    try {
        if (fs.existsSync(LOGS_PATH)) {
            fs.unlinkSync(LOGS_PATH)
        }
        return true
    } catch (err) {
        console.error('❌ Ошибка очистки логов:', err.message)
        return false
    }
}