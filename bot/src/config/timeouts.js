export const TIMEOUT_CONFIG = {

base: {
        pageLoad: 30000,      
        elementWait: 10000,    
        apiRequest: 30000,     
        networkIdle: 5000      
    },
    
    // Увеличенные таймауты для медленных ситуаций
    extended: {
        pageLoad: 60000,       
        elementWait: 30000,    
        apiRequest: 60000,     
        networkIdle: 10000     
    },
    
    // Настройки повторных попыток
    retry: {
        maxAttempts: 3,        
        delay: 2000,           
        backoffMultiplier: 2,  
        
        // Какие ошибки стоит повторять
        retryableErrors: [
            'TimeoutError',
            'ERR_NETWORK_CHANGED',
            'ECONNRESET',
            'ETIMEDOUT',
            '429'  
        ]
    },
    
    
    actions: {
        click: 5000,           
        type: 1000,            
        screenshot: 2000       
    }
};

export function getTimeout(type,isExtended = false){
    const config = isExtended ? TIMEOUT_CONFIG.extended : TIMEOUT_CONFIG.base;
    return config[type] || config.elementWait
}