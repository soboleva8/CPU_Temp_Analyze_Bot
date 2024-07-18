import { Bot, InlineKeyboard } from 'grammy';
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

let monitoringEnabled = true;
let exceedStartTime = null;
let exceedCount = 0;
const exceedChecksRequired = Math.ceil(EXCEED_DURATION / MONITOR_INTERVAL);

const keyboard = new InlineKeyboard()
  .text("Проверить загрузку CPU", "cpu")
  .row()
  .text("Включить мониторинг", "enable_monitoring")
  .text("Отключить мониторинг", "disable_monitoring");

bot.command('start', (ctx) => {
  ctx.reply("Привет! Я бот для мониторинга системы. Выберите действие:", {
    reply_markup: keyboard
  });
});

bot.on("callback_query:data", async (ctx) => {
  const action = ctx.callbackQuery.data;

  if (action === "cpu") {
    try {
      const load = await si.currentLoad();
      ctx.reply(`Загрузка процессора: ${load.currentLoad.toFixed(2)}%`);
    } catch (error) {
      console.error(error);
      ctx.reply("Произошла ошибка при получении загрузки процессора.");
    }
  } else if (action === "enable_monitoring") {
    monitoringEnabled = true;
    ctx.reply("Мониторинг и отправка уведомлений включены.");
  } else if (action === "disable_monitoring") {
    monitoringEnabled = false;
    ctx.reply("Мониторинг и отправка уведомлений отключены.");
  }
});

async function monitorCpuLoad() {
  if (!monitoringEnabled) return;

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

      if (exceedCount >= exceedChecksRequired) {
        await bot.api.sendMessage(GROUP_ID, `Внимание! Загрузка процессора превышает пороговое значение: ${cpuLoad}%`);
        monitoringEnabled = false;
        exceedStartTime = null;
        exceedCount = 0;
      }
    } else {
      exceedStartTime = null;
      exceedCount = 0;
    }
  } catch (error) {
    console.error("Произошла ошибка при мониторинге загрузки процессора:", error);
  }
}

setInterval(monitorCpuLoad, MONITOR_INTERVAL);

bot.start();