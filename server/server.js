import express from 'express'
import dotenv from 'dotenv';
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'

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

function readJSON(fileName, defaultValue){
    const filePath = path.join(DATA_PATH, fileName)

    try{
        if(!fs.existsSync(filePath)){
            fs.writeFileSync(filePath, JSON.stringify(defaultValue,null,2))
            return defaultValue
        }
        const data = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(data)
    }catch(err){
        console.log(`Ошибка чтения ${fileName}:`, err)
        return defaultValue
    }
}

function writeJSON(fileName,data){
    const filePath = path.join(DATA_PATH,fileName)

    try{    
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
        return true
    }catch(err){
        console.log(`Ошибка записи ${fileName}:`, err)
        return false
    }
}



app.get('/api/health', (req,res) =>{
    res.json({status: 'ok'})
})

app.get('/api/settings', (req,res) =>{
    try{
        const settings = readJSON('settings.json', DEFAULT_SETTINGS)
        res.json(settings)
    }catch(err){
        console.log('❌ Ошибка чтения настроек:', err)
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера'
        })
    }
})

app.post('/api/settings', (req,res) =>{
    const newSettings = req.body
     if (!newSettings || typeof newSettings !== 'object' || Array.isArray(newSettings)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Неверный формат данных. Ожидается объект с настройками' 
        })
    }

    const success = writeJSON('settings.json', newSettings)
    if(success){
        res.json({success:true,message:'Настройки сохранены'})
    }else {
        res.status(500).json({success: false, error:'Ошибка сохранения'})
    }
})

app.post('/api/settings/reset', (req,res)=>{
    try {
        const success = writeJSON('settings.json',DEFAULT_SETTINGS)

        if(success) {
            res.json({
                success: true, 
                message: 'Настройки сброшены',
                settings: DEFAULT_SETTINGS
            })
        }else{
            res.status(500).json({ success: false, error: 'Ошибка сброса' })
        }
    } catch (error) {
        console.error('❌ Ошибка сброса настроек:', error)
        res.status(500).json({ success: false, error: 'Ошибка сброса' })
    }
})

app.post('/api/search/start', async (req,res)=>{
    try{
        const settings = req.body.settings || readJSON('settings.json',DEFAULT_SETTINGS)
        console.log('\n🔍 ЗАПУСК ПОИСКА')
        console.log('   Должность:', settings.jobTitle)
        console.log('   Город:', settings.city)

        const vacancies = await bot.runSearch(settings)
        writeJSON('vacancies.json',vacancies)

        res.json({
            success:true,
            count: vacancies.length,
            vacancies: vacancies
        })
    }catch(err){
        console.log('❌ Ошибка поиска:', err.message)
        res.status(500).json({ success: false, error: err.message})
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

app.use((req, res) =>{
    res.status(404).json({
        success:false,
        error: 'Маршрут не найден'
    })
})

app.listen(PORT, ()=>{
    console.log(`🚀 Сервер запущен на порту ${PORT}`)
    console.log(`📁 Данные: ${DATA_PATH}`)
    console.log(`🌐 http://localhost:${PORT}/api/health`)

})

