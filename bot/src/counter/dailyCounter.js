import fs from 'fs'
import schedule from 'node-schedule'


const COUNTER_FILE = './counter.json';

export class DailyCounter {
    constructor(maxDaily = 80){
        this.maxDaily = maxDaily
        this.count = 0
        this.lastReset = new Date().toDateString()
        this.load()
        this.scheduleReset()
    }


    load(){
        if(fs.existsSync(COUNTER_FILE)){
            try{
                const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'))
                this.count = data.count || 0;
                this.lastReset = data.lastReset ||  new Date().toDateString();

                const today = new Date().toDateString()
                if(this.lastReset !== today){
                    this.reset()
                }
            }catch(err){
                console.warn('⚠️ Ошибка загрузки счётчика, создаём новый');
                this.reset();
            }
        }else {
            this.reset();
        }
    }

    save(){
        const data = {
            count: this.count,
            lastReset: this.lastReset
        }
        fs.writeFileSync(COUNTER_FILE, JSON.stringify(data,null,2))
    }

    reset(){
        console.log('🔄 Сброс счётчика в 00:00')

        this.count = 0
        this.lastReset = new Date().toDateString()
        this.save()
    }

    scheduleReset(){
        schedule.scheduleJob('0 0 * * *',()=>{
            this.reset()
        })
        console.log('⏰ Запланирован сброс счётчика каждый день в 00:00');
    }

    increment(){
        if(this.count >= this.maxDaily){
            console.log(`⚠️ Достигнут лимит ${this.maxDaily} откликов на сегодня`)
            return false;
        }

        this.count++
        this.save()
        console.log(`📊 Откликов сегодня: ${this.count}/${this.maxDaily}`)
        return true
    }

    canApply(){
        return this.count < this.maxDaily
    }

    getStatus(){
        return{
            count: this.count,
            maxDaily: this.maxDaily,
            remaining: this.maxDaily - this.count,
            lastReset: this.lastReset
        }
    }

}