import express from 'express'
import dotenv from 'dotenv';
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'


const PORT = process.env.PORT || 3001

dotenv.config()

const app = express()
app.use(express.json())

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_PATH = path.join(__dirname, 'data')

if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH)
    console.log('📁 Создана папка data')
}

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
        console.log('❌ Ошибка чтения настроек:', err, err)
    }
})

app.post('/api/settings', (req,res) =>{
    const newSettings = req.body
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

app.listen(PORT, ()=>{
    console.log(`🚀 Сервер запущен на порту ${PORT}`)
    console.log(`📁 Данные: ${DATA_PATH}`)
    console.log(`🌐 http://localhost:${PORT}/api/health`)

})

