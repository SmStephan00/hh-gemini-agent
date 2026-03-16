import axios from 'axios';
import { withRetry, isRetryableError } from './errorHandler.js';
import { TIMEOUT_CONFIG } from '../config/timeouts.js';

export function createApiClient(baseURL,customConfig={}) {
    const client = axios.create({
        baseURL,
        timeout: TIMEOUT_CONFIG.base.apiRequest,
        ...customConfig
    })

    client.interceptors.request.use(config =>{
        console.log(`📡 API Запрос: ${config.method.toUpperCase()} ${config.url}`)
        return config
    })

    client.interceptors.response.use(
        response => {
            console.log(`   ✅ API Ответ: ${response.status}`);
            return response;
        },
        error => {
            if (error.response) {
                console.log(`   ❌ API Ошибка: ${error.response.status}`);
                console.log(`      ${error.response.statusText}`);
            } else if (error.request) {
                console.log(`   ❌ API Нет ответа: ${error.message}`);
            } else {
                console.log(`   ❌ API Ошибка: ${error.message}`);
            }
            return Promise.reject(error);
        }
    )
    return client;
}

export async function apiRequest(method, url, options = {}) {
    const {
        data = null,
        params = null,
        headers = {},
        baseURL = '',
        maxAttempts = 3,
        timeout = TIMEOUT_CONFIG.base.apiRequest
    } = options;
    
    // Создаем клиент
    const client = createApiClient(baseURL);
    
    // Оборачиваем запрос в retry механизм
    const makeRequest = async () => {
        const config = {
            method,
            url,
            timeout,
            headers,
            params
        };
        
        if (data) {
            config.data = data;
        }
        
        return await client.request(config);
    };
    
    try {
        const response = await withRetry(makeRequest, {
            maxAttempts,
            baseDelay: 2000,
            onRetry: (attempt, error, delay) => {
                console.log(`   🔄 Повторная попытка ${attempt} через ${delay}мс`);
            }
        });
        
        return response.data;
        
    } catch (error) {
        console.error(`❌ API запрос провалился после всех попыток:`, error.message);
        throw error;
    }
}

// Упрощенные функции для разных методов
export const api = {
    get: (url, options) => apiRequest('get', url, options),
    post: (url, data, options) => apiRequest('post', url, { ...options, data }),
    put: (url, data, options) => apiRequest('put', url, { ...options, data }),
    delete: (url, options) => apiRequest('delete', url, options)
};