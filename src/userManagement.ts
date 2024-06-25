import {GET_INITIAL_FOLLOWINGS, GET_INSTAGRAM_ID} from './instagramUtils'
import { PrismaClient } from '@prisma/client'
import { TelegramBot } from './instalkerBot';

const prisma = new PrismaClient();
prisma.$connect();


type StoreInstaUserSuccess = {
  status: 'success';
  message: string;
  instagram_id: string;
};

type StoreInstaUserFail = {
  status: 'fail' | 'inaccessible'; 
  message: string;
};

type ErrorStatus = {
  status: 'error';
  error: Error; 
};

export type StoreInstaUserResult = StoreInstaUserSuccess | StoreInstaUserFail | ErrorStatus;

export async function STORE_INSTAGRAM_USER(telegramId: number, instagramUserName: string = ''): Promise<StoreInstaUserResult> {
  try {
    const { instagram_id, is_private, message } = await GET_INSTAGRAM_ID(instagramUserName);

    if (!instagram_id) {
      return { message, status: 'fail' };
    }

    if (is_private) {
      return { message, status: 'inaccessible' };
    }

    const target = await prisma.target.create({
      data: {
        telegramId: telegramId,
        instagramUsername: instagramUserName,
        instagramId: instagram_id,
      },
    });

    return { status: 'success', instagram_id, message};
  } catch (error) {
    return { status: 'error', error };
  }
}
  type TelegramUser = {
    telegramId: number;
    telegramUsername: string;
  }

  type storeTelegramUserResult = TelegramUser | ErrorStatus;
  export async function STORE__TELEGRAM__USER(telegramId : number, telegramUsername : string = ''): Promise<storeTelegramUserResult> {
    try {
      const telegramUser = await prisma.telegramUsers.findFirst({
        where: { telegramId: telegramId},
      });
      if(!telegramUser){
        const newTelegramUser = await prisma.telegramUsers.create({
          data: {
            telegramId: telegramId,
            telegramUsername: telegramUsername,
          },
  
        });
        return newTelegramUser;
      }
      
    } catch (error) {
      return { status: 'error', error };
    } 
  }
  type Target = {
          telegramUsername: string;
          telegramId: Number;
          instagramUsername : string;
          instagramId: string;
          followings: Array<string>;
  }

  type storeFollowingsResult = Target | ErrorStatus;
export async function STORE_FOLLOWINGS(telegramUsername :string =  '', telegramId : number , instagramUsername : string , instagram_id :string = '', usernames: (string | undefined)[]): Promise<storeFollowingsResult> {
    try {
      const target = await prisma.followings.create({
        data: {
          telegramUsername: telegramUsername,
          telegramId: telegramId,
          instagramUsername : instagramUsername,
          instagramId: instagram_id,
          followings: usernames,
        },
      }); 
      return target;
    } catch (error) {
      return { status: 'error', error };
    
    } 
  
  }
  type newFollowing = Array<string | undefined>;
  type noFollowings = [];
type newFollowingResult = newFollowing | noFollowings;
export async function FIND_NEW_FOLLOWING(telegramId: number, instagram_id:string = ''): Promise<newFollowingResult> {
    const followings : Array<string> = await GET_INITIAL_FOLLOWINGS(instagram_id);
    try {
      const following = await prisma.followings.findFirst({
        where: {
          instagramId: instagram_id.toString(),
          telegramId: telegramId
        }
      });
  
      if (following && Array.isArray(following.followings) && Array.isArray(followings)) {
        let newFollowing : Array<string | undefined> = followings.filter(element => !following.followings.includes(element));
        if (newFollowing.length > 0) {
        prisma.followings.updateMany({
            where: {
              instagramId: instagram_id 
            },
            data: {
              followings: {
                push: newFollowing
              }
            }
          });
          return newFollowing;
        } 
        
      } 
    } catch (error) {
      return error;
    }
  }


  type ChangeTargetSuccess = {
    status: "success";
    message: "Користувача змінено";
  }

  export type ChangeTargetResult = ChangeTargetSuccess | ErrorStatus;
  export async function CHANGE_TARGET(telegramId: number): Promise<ChangeTargetResult> {
    try {
      const target = await prisma.target.findFirst({
        where: { telegramId: telegramId },
      });
  
      if (target) {
        const deletedTarget = await prisma.target.deleteMany({
          where: { telegramId: telegramId },
        });
        const targetFollowings = await prisma.followings.findFirst({
          where: { telegramId: telegramId },
        });
  
        if (targetFollowings) {
          const deletedFollowings = await prisma.followings.deleteMany({
            where: { telegramId: telegramId },
          });
        }
  
        return { status: 'success', message: 'Користувача змінено' };
      } 
    } catch (error) {
     
      return { status: 'error', error };
    }
  }

  let intervalId;
  let isTracking = false;
  let currentIndex = 0;

  export async function TRACK_USERS(bot : TelegramBot) {
    try {
      isTracking = true;
      const users = await prisma.followings.findMany();
      if (users.length === 0) {
        return;
      }
  
      intervalId = setInterval(async () => {
        if (!isTracking) {
          clearInterval(intervalId);
          await prisma.$disconnect();
          return;
        }
        try {
          const user = users[currentIndex];
          const newFollowing : newFollowing  = await FIND_NEW_FOLLOWING(user.telegramId, user.instagramId);
          if (newFollowing.length > 0) {
            await bot.sendMessage(user.telegramId, `Користувач ${user.instagramUsername} підписався на ${newFollowing.join(', ')}`);
          }
  
          currentIndex = (currentIndex + 1) % users.length;
  
        } catch (error) {
          return error;
        }
  
      }, 5000); 
  
    } catch (error) {
        return error;
    }
  }

function stopTracking() {
  isTracking = false;
}


export async function CHECK_USER_CONNECTION(telegramId) {
  try {
    const telegramUser = await prisma.target.findFirst({
      where: { telegramId: telegramId},
    });
    return telegramUser ? true : false;
  } catch (error) {
    console.error('Error checking user connection:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}








