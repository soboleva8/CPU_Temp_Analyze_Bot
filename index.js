import { Bot } from 'grammy';
import si from 'systeminformation';
import dotenv from 'dotenv';
import { cleanEnv, str, num } from 'envalid';

dotenv.config();

const env = cleanEnv(process.env, {
  CPU_GUARD_BOT_TOKEN: str(),
  TELEGRAM_GROUP_ID: str(),
  CPU_THRESHOLD: num(),
  MONITOR_INTERVAL: num(),
  EXCEED_DURATION: num()
});

const BOT_TOKEN = env.CPU_GUARD_BOT_TOKEN;
const GROUP_ID = env.TELEGRAM_GROUP_ID;
const CPU_THRESHOLD = env.CPU_THRESHOLD;
const MONITOR_INTERVAL = env.MONITOR_INTERVAL;
const EXCEED_DURATION = env.EXCEED_DURATION;

const bot = new Bot(BOT_TOKEN);

let exceedStartTime = null;
let exceedCount = 0;
const exceedChecksRequired = Math.ceil(EXCEED_DURATION / MONITOR_INTERVAL);

// Обработка команды /start
bot.command('start', (ctx) => {
  ctx.reply("Привет! Я бот для мониторинга системы. Напиши /temperature для получения температуры процессора или /cpu для получения загрузки процессора.");
});

// Обработка команды /temperature
bot.command('temperature', async (ctx) => {
  try {
    const data = await si.cpuTemperature();
    if (data.main !== null) {
      ctx.reply(`Температура процессора: ${data.main}°C`);
    } else {
      ctx.reply("Не удалось получить температуру процессора. Возможно, сенсоры не поддерживаются.");
    }
  } catch (error) {
    console.error(error);
    ctx.reply("Произошла ошибка при получении температуры процессора.");
  }
});

// Обработка команды /cpu
bot.command('cpu', async (ctx) => {
  try {
    const load = await si.currentLoad();
    ctx.reply(`Загрузка процессора: ${load.currentLoad.toFixed(2)}%`);
  } catch (error) {
    console.error(error);
    ctx.reply("Произошла ошибка при получении загрузки процессора.");
  }
});

// Функция для мониторинга загрузки процессора
async function monitorCpuLoad() {
  try {
    const load = await si.currentLoad();
    const cpuLoad = parseFloat(load.currentLoad.toFixed(2));
    console.log(`Текущая загрузка процессора: ${cpuLoad}%`);

    if (cpuLoad > CPU_THRESHOLD) {
      if (exceedStartTime === null) {
        exceedStartTime = Date.now();
        exceedCount = 1;
      } else {
        exceedCount++;
      }

      // Если превышение загрузки происходит достаточно долго
      if (exceedCount >= exceedChecksRequired) {
        await bot.api.sendMessage(GROUP_ID, `Внимание! Загрузка процессора превышает пороговое значение: ${cpuLoad}%`);
        console.log("Бот завершает работу после отправки сообщения.");
        process.exit(0); // Завершение работы скрипта после отправки сообщения
      }
    } else {
      // Если загрузка ниже порога, сбрасываем время и счетчик превышений
      exceedStartTime = null;
      exceedCount = 0;
    }
  } catch (error) {
    console.error("Произошла ошибка при мониторинге загрузки процессора:", error);
  }
}

// Запуск мониторинга загрузки процессора с интервалом
setInterval(monitorCpuLoad, MONITOR_INTERVAL);

// Запуск бота
bot.start();