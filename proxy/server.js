import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Хранилище для текущего URL туннеля
let currentTunnelUrl = null;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Прокси работает!',
        tunnelUrl: currentTunnelUrl 
    });
});

// Получить текущий URL туннеля
app.get('/tunnel-url', (req, res) => {
    if (currentTunnelUrl) {
        res.json({ url: currentTunnelUrl });
    } else {
        res.status(404).json({ error: 'Tunnel URL not set yet' });
    }
});

// Установить URL туннеля (вызывается из workflow)
app.post('/tunnel-url', express.json(), (req, res) => {
    const { url } = req.body;
    if (url) {
        currentTunnelUrl = url;
        console.log('✅ Tunnel URL updated:', url);
        res.json({ success: true, url });
    } else {
        res.status(400).json({ error: 'URL required' });
    }
});

// Основной обработчик для Gemini
app.post('/api/gemini/generate', async (req, res) => {
    try {
        const { model, contents } = req.body;
        console.log(`📤 Запрос к Gemini через прокси: ${model}`);
        
        // Проверяем наличие ключа
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY не найден');
        }
        
        // Отправляем запрос в Google
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{ text: contents }]
                }]
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );
        
        console.log('✅ Ответ получен от Gemini');
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Ошибка прокси:', error.message);
        
        if (error.response) {
            res.status(error.response.status).json({
                error: 'Gemini API Error',
                details: error.response.data,
                message: error.message
            });
        } else {
            res.status(500).json({ 
                error: 'Proxy Error', 
                message: error.message 
            });
        }
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Прокси запущен на порту ${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 Tunnel URL endpoint: http://localhost:${PORT}/tunnel-url`);
    console.log(`🤖 Gemini endpoint: http://localhost:${PORT}/api/gemini/generate\n`);
});