import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

console.log("=== ОТЛАДКА ПРОКСИ ===");
console.log("GEMINI_API_KEY загружен:", process.env.GEMINI_API_KEY ? "✅ ДА" : "❌ НЕТ");
console.log("Длина ключа:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0);
console.log("========================");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Прокси работает!'
    });
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
    console.log(`🤖 Gemini endpoint: http://localhost:${PORT}/api/gemini/generate\n`);
});