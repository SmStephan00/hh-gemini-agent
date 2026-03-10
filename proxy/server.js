import express from 'express'
import axios from 'axios'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3001;

app.use(cors())

app.use(express.json())

app.use((req,res,next)=>{
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next()
})

app.get('/health' , (req,res)=>{
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Прокси работает!'
    })
})

app.post('/api/gemini/generate', async (req,res)=>{
    try{
        const {model, contents} = req.body

        console.log(`📤 Получен запрос к модели: ${model}`);
        console.log(`📝 Содержание: ${contents.substring(0, 100)}...`);

        if(!process.env.GEMINI_API_KEY){
            throw new Error('GEMINI_API_KEY не найден в .env файле')
        }

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents:[{
                    parts:[{text: contents}]
                }]
            },
            {
                headers:{
                    'Content-Type' : 'application/json'
                },
                timeout:30000
            }
        )

        console.log('✅ Успешный ответ от Gemini');

        res.json(response.data)


    }catch (error) {
    console.error('❌ Ошибка в прокси:', error.message);
    
    // Подробный лог ошибки
    if (error.response) {
        // Ошибка от Gemini API (сервер вернул ответ с ошибкой)
        console.error('Статус ошибки:', error.response.status);
        console.error('Детали:', error.response.data);
        
        res.status(error.response.status).json({
            error: 'Gemini API Error',
            details: error.response.data,
            message: error.message
        });
        
    } else if (error.request) {
        // Ошибка сети (не достучались до Gemini)
        console.error('Нет ответа от Gemini API');
        
        res.status(503).json({
            error: 'Network Error',
            message: 'Не удалось连接到 Gemini API',
            details: error.message
        });
        
    } else {
        // Внутренняя ошибка прокси
        res.status(500).json({
            error: 'Proxy Error',
            message: error.message
        });
    }
}
})

app.get('/api/gemini/models', async (req, res) => {
    try {
        const response = await axios.get(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
        );
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 Прокси-сервер ЗАПУЩЕН!');
    console.log('='.repeat(50));
    console.log(`📡 Порт: ${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`🤖 Gemini endpoint: http://localhost:${PORT}/api/gemini/generate`);
    console.log('='.repeat(50) + '\n');
});