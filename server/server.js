import express from 'express'
import dotenv from 'dotenv';
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import multer from 'multer'

import { BotRunner } from './botRunner.js'

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())
const PORT = process.env.PORT || 3001

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_PATH = path.join(__dirname, 'data')

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
    next()
})

if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH)
    console.log('📁 Создана папка data')
}

const bot = new BotRunner()

const DEFAULT_SETTINGS = {
    jobTitle: '',
    city: '',
    salaryFrom: '',
    salaryTo: '',
    experience: '',
    schedule: [],
    employment: [],
    exception: ''
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '..', 'bot', 'uploads')
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true })
        }
        cb(null, uploadPath)
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const ext = path.extname(file.originalname)
        cb(null, `resume-${uniqueSuffix}${ext}`)
    }
})

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true)
        } else {
            cb(new Error('Только PDF файлы'))
        }
    }
})

function readJSON(fileName, defaultValue) {
    const filePath = path.join(DATA_PATH, fileName)

    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2))
            return defaultValue
        }
        const data = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(data)
    } catch (err) {
        console.log(`Ошибка чтения ${fileName}:`, err)
        return defaultValue
    }
}

function writeJSON(fileName, data) {
    const filePath = path.join(DATA_PATH, fileName)

    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
        return true
    } catch (err) {
        console.log(`Ошибка записи ${fileName}:`, err)
        return false
    }
}

function cleanSettings(settings) {
    const cleaned = { ...settings }
    
    Object.keys(cleaned).forEach(key => {
        const value = cleaned[key]
        
        // Удаляем если:
        // - undefined или null
        // - пустая строка
        // - пустой массив
        if (value === undefined || 
            value === null || 
            value === '' || 
            (Array.isArray(value) && value.length === 0)) {
            delete cleaned[key]
        }
    })
    
    return cleaned
}

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' })
})

app.get('/api/settings', (req, res) => {
    try {
        const settings = readJSON('settings.json', DEFAULT_SETTINGS)
        res.json(settings)
    } catch (err) {
        console.log('❌ Ошибка чтения настроек:', err)
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера'
        })
    }
})

app.post('/api/upload/resume', upload.single('resume'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' })
        }
        
        // Абсолютный путь к файлу
        const absolutePath = path.join(__dirname, '..', 'bot', 'uploads', req.file.filename)
        
        res.json({
            success: true,
            filePath: absolutePath,  // ← абсолютный путь
            fileName: req.file.originalname,
            message: 'Резюме загружено'
        })
    } catch (error) {
        console.error('Ошибка загрузки:', error)
        res.status(500).json({ error: 'Ошибка загрузки файла' })
    }
})

app.post('/api/response/batch', async (req,res) =>{
    try{
        const { vacancies, resumePath, userPrompt, options } = req.body

        let vacanciesToRespond = vacancies

        if(!vacanciesToRespond || vacanciesToRespond.length === 0){
            vacanciesToRespond = readJSON('vacancies.json', [])
        }

        if(vacanciesToRespond.length === 0){
            return res.status(400).json({
                success: false,
                error: 'Нет вакансий для отклика'
            })
        }

        const results = await bot.batchRespond(
            
            vacanciesToRespond,
            resumePath,
            userPrompt || '',
            options || {}
        )

        const stats = readJSON('stats.json', {
            totalResponses: 0,
            successful: 0,
            failed: 0,
            companies: [],
            lastUpdated: new Date().toISOString()
        })

        stats.totalResponses += results.success + results.failed
        stats.successful += results.success
        stats.failed += results.failed
        stats.lastUpdated = new Date().toISOString()

        results.details.forEach(item => {
            if(item.status === 'success' && !stats.companies.includes(item.company)) {
                stats.companies.push(item.company)
            }
        })

        writeJSON('stats.json' , stats)

        res.json({ success: true, results })
        
    }catch (error) {
        console.error('❌ Ошибка отклика:', error.message)
        res.status(500).json({ success: false, error: error.message })
    }

})

app.post('/api/settings', (req, res) => {
    const newSettings = req.body
    if (!newSettings || typeof newSettings !== 'object' || Array.isArray(newSettings)) {
        return res.status(400).json({
            success: false,
            error: 'Неверный формат данных. Ожидается объект с настройками'
        })
    }

    const success = writeJSON('settings.json', newSettings)
    if (success) {
        res.json({ success: true, message: 'Настройки сохранены' })
    } else {
        res.status(500).json({ success: false, error: 'Ошибка сохранения' })
    }
})

app.post('/api/settings/reset', (req, res) => {
    try {
        const success = writeJSON('settings.json', DEFAULT_SETTINGS)

        if (success) {
            res.json({
                success: true,
                message: 'Настройки сброшены',
                settings: DEFAULT_SETTINGS
            })
        } else {
            res.status(500).json({ success: false, error: 'Ошибка сброса' })
        }
    } catch (error) {
        console.error('❌ Ошибка сброса настроек:', error)
        res.status(500).json({ success: false, error: 'Ошибка сброса' })
    }
})

app.get('/api/history', (req, res) => {
    try {
        // Путь к bot-data.json (где хранится история)
        const botDataPath = path.join(__dirname, '..', 'bot', 'bot-data.json')
        
        if (fs.existsSync(botDataPath)) {
            const data = JSON.parse(fs.readFileSync(botDataPath, 'utf8'))
            res.json({
                success: true,
                completed: data.completed || [],
                pending: data.pending || [],
                errors: data.errors || []
            })
        } else {
            // Если файла нет, возвращаем пустую историю
            res.json({
                success: true,
                completed: [],
                pending: [],
                errors: []
            })
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки истории:', error)
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка загрузки истории' 
        })
    }
})

app.post('/api/search/start', async (req, res) => {
    try {
        // Получаем настройки из запроса или из файла
        let settings = req.body.settings || readJSON('settings.json', DEFAULT_SETTINGS)
        
        // Очищаем от пустых значений
        settings = cleanSettings(settings)
        
        console.log('\n🔍 ЗАПУСК ПОИСКА')
        console.log('   Должность:', settings.jobTitle || 'не указана')
        console.log('   Город:', settings.city || 'не указан')
        console.log('   Параметры:', Object.keys(settings).filter(k => 
            !['jobTitle', 'city'].includes(k)
        ))

        const vacancies = await bot.runSearch(settings)
        writeJSON('vacancies.json', vacancies)

        res.json({
            success: true,
            count: vacancies.length,
            vacancies: vacancies
        })
    } catch (err) {
        console.log('❌ Ошибка поиска:', err.message)
        res.status(500).json({ success: false, error: err.message })
    }
})



process.on('SIGINT', async () => {
    console.log('\n\n🛑 Получен сигнал завершения...')
    await bot.closeBrowser()
    console.log('👋 Сервер остановлен')
    process.exit(0)
})

app.use((err, req, res, next) => {
    console.error('❌ Ошибка сервера:', err)
    res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера'
    })
})

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Маршрут не найден'
    })
})

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`)
    console.log(`📁 Данные: ${DATA_PATH}`)
    console.log(`🌐 http://localhost:${PORT}/api/health`)
})