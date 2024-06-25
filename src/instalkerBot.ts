
import * as TelegramBot from 'node-telegram-bot-api';
import { STORE__TELEGRAM__USER ,STORE_INSTAGRAM_USER , STORE_FOLLOWINGS , TRACK_USERS , CHECK_USER_CONNECTION ,CHANGE_TARGET, StoreInstaUserResult, ChangeTargetResult} from './userManagement'
import { initializePuppeteer , GET_INITIAL_FOLLOWINGS } from './instagramUtils'


interface TelegramError extends Error {
  code?: string;
  response?: any;
  description?: string;
}


export interface TelegramBot {
  sendMessage(chatId: number | string, text: string, options?: object): Promise<Message>;
  onText(regex: RegExp, callback: (msg: Message, match: RegExpExecArray | null) => void): void;
  on(event: 'message' | 'polling_error' | 'callback_query' | string, callback: (msg: Message | TelegramError) => void): void;
  once(event: 'message' | 'polling_error' | 'callback_query' | string, callback: (msg: Message | TelegramError) => void): void;
    stopPolling(): Promise<void>;
    startPolling(): Promise<void>;
}

interface User {
  id: number;
  username?: string;
}

interface Chat {
  id: number;
}

interface Message {
  chatId: number;
  from?: User;
  text?: string;
  chat: Chat;

}


const token = '6856388742:AAGJvr7BjQlgZaIcLLhxtgumgWoXp6VZXQk';
const bot : TelegramBot= new TelegramBot(token, { polling: true });
TRACK_USERS(bot);

bot.onText(/\/start/, async (msg : Message) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isConnected = await CHECK_USER_CONNECTION(userId); 
  
    const welcomeMessage = `Це чат-бот Instalker🎀
  
    Що дає цей бот?
    
    ⭐️Відстежувати підписників:
    Відстежуйте останніх підписників будь-якого користувача Instagram.
    
    ⭐️Отримувати сповіщення:
    Отримуйте сповіщення, коли обраний вами користувач отримує нових підписників.`;
    
    const options = {
      reply_markup: {
        keyboard: [
          ['/continue']
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    };
    const warningMessage = "Функція уже підключена. Якщо ви бажаєте змінити користувача, використайте команду /change";
  
    if (!isConnected) {
      bot.sendMessage(chatId, welcomeMessage, options);
    } else {
      bot.sendMessage(chatId, warningMessage);
    }
  })

  bot.onText(/\/continue/, (msg : Message) => {
    const chatId = msg.chat.id;
    const options = {
      reply_markup: {
        keyboard: [
          ['Так'],
          ['Ні']
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    };
  
    const processionWarning = `Перш ніж ми почнемо, чи згодні ви на обробку 
    вашого Telegram ID та імені користувача для цього сервісу? [Так/Ні].`
    bot.sendMessage(chatId, processionWarning, options);
  });

  async function handleInstagramUsername(msg : Message , instagramUsername : string = "")  {
  const chatId : number= msg.chat.id;
  const telegramId : number = msg.from.id;
  const telegramUsername : string = msg.from.username.toString();

  try {
    await bot.sendMessage(chatId, "Зачекайте трішки! Йде пошук користувача");
    const storedUser :StoreInstaUserResult  = await STORE_INSTAGRAM_USER(telegramId, instagramUsername);
    switch (storedUser.status) {
      case "success":
        const instagram_id = storedUser.instagram_id;
        await bot.sendMessage(chatId, storedUser.message);

        const usernames = await GET_INITIAL_FOLLOWINGS(instagram_id);
        await STORE_FOLLOWINGS(telegramUsername, telegramId, instagramUsername, instagram_id, usernames);

        await bot.sendMessage(chatId, "Функція підключена , очікуйте сповіщення🎀");
        break;
      
      case "inaccessible":
      case "fail":
        await bot.sendMessage(chatId, storedUser.message);
        break;
      
      default:
        bot.sendMessage("Сталась помилка в системі!Будь ласка спробуйте пізніше або зверніться в технічну підтримку");

    }


  } catch (error) {
    if (error.message.includes("User not found")) {
      await bot.sendMessage(chatId, "Користувач Instagram не знайдений. Спробуйте ще раз натиснувши /find у меню");
    } else {
      await bot.sendMessage(chatId, "Сталася помилка. Будь ласка, спробуйте ще раз. Спробуйте ще раз натиснувши /find у меню");
      console.error(error);
    }
  }
}
bot.onText(/Так/, (msg : Message) => {
  const telegramId : number = msg.from.id;
  const telegramUsername : string = msg.from.username;
  STORE__TELEGRAM__USER(telegramId, telegramUsername);
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "🔍 Чудово! Тепер введіть нікнейм користувача Instagram:");
  bot.once('text', async (msg : Message)  => { 
    const instagramUsername = msg.text;
    await handleInstagramUsername(msg, instagramUsername);
  });
});


bot.onText(/Ні/, (msg : Message) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Ваші дані не будуть оброблятися. Якщо передумаєте, оберіть команду /continue в меню");
});

bot.onText(/\/find/, async (msg : Message) => {
  const userId = msg.from.id;
  if (msg.text && !msg.text.startsWith('/')) {
    const instagramUsername = msg.text;
    await handleInstagramUsername(msg, instagramUsername);
  } else {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Будь ласка, введіть коректний нікнейм Instagram.");
  }
});


bot.onText(/\/change/, async (msg : Message) => {
  let chatId = msg.chat.id;
  const telegramId : number = msg.from.id;
  const telegramUsername : string = msg.from.username;
    bot.sendMessage(chatId, "Будь ласка, введіть нікнейм нового користувача");
    bot.once('text', async (msg : Message) => { 
      chatId = msg.chat.id;
      const instagramUsername = msg.text;
      const result: ChangeTargetResult = await CHANGE_TARGET(telegramId);
      if (result.status === 'success') {
        await handleInstagramUsername(msg, instagramUsername);
        await bot.sendMessage(chatId, result.message);
      } 
    else {
      bot.sendMessage(chatId, "Будь ласка, введіть коректний нікнейм Instagram.");
    }
    });

   
    
});

function alertAdmin(error: TelegramError) {
  const adminChatId = 'YOUR_ADMIN_CHAT_ID';
  const errorMessage = `Помилка опитування: ${error.message || 'Невідома помилка'}\nКод: ${error.code || 'Н/Д'}`;
  bot.sendMessage(adminChatId, errorMessage);
}

let retryCount = 0;
const maxRetries = 5;
const retryDelay = 5000; 

bot.on('polling_error', (error: Message | TelegramError) => {
  if (error instanceof Error) {
    console.error('Помилка опитування:', error.message || 'Невідома помилка');
    if (error.code) {
      console.error('Код помилки:', error.code);
    }
    if ('stack' in error) {
      console.error('Стек помилки:', error.stack);
    }
    alertAdmin(error);

    if (retryCount < maxRetries) {
      console.log(`Повтор через ${retryDelay / 1000} секунд... (Спроба ${retryCount + 1}/${maxRetries})`);
      setTimeout(() => {
        retryCount++;
        bot.stopPolling()
          .then(() => bot.startPolling())
          .catch(err => console.error('Не вдалося перезапустити опитування:', err.message || 'Невідома помилка'));
      }, retryDelay);
    } else {
      console.error('Досягнуто максимуму спроб. Вимкнення.');
      alertAdmin(new Error('Досягнуто максимуму спроб. Вимкнення бота.'));
      bot.stopPolling();
      process.exit(1); 

    }
  }
});
initializePuppeteer();

