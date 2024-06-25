import * as cheerio from 'cheerio';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import  * as fs from 'fs';
import * as dotenv from 'dotenv';
import {t} from 'typy'
import { HTTPResponse } from 'puppeteer';


const INSTAGRAM_LOGIN = "scrapper5090"
const INSTAGRAM_PASSWORD = "weioj3j3ho3dc";
const cookies = INSTAGRAM_LOGIN + ".txt";

const startUrl = "https://www.instagram.com/direct/inbox/";
const loginPage = "accounts/login";
let globalPage; 

const userDataPath = path.resolve(__dirname, 'session_data');
export async function initializePuppeteer() {
    const browser = await puppeteer.launch({ headless: false ,  userDataDir: userDataPath });
    globalPage = await browser.newPage();
  
    if (fs.existsSync(cookies)) {
      let sCookie = fs.readFileSync(cookies, "utf8");
      let aCookie = JSON.parse(sCookie);
      await globalPage.setCookie(...aCookie);
    }
  
    const response = await globalPage.goto(startUrl);
     if (response.url().indexOf(loginPage) != -1) {
      await globalPage.waitForSelector('button');
      await globalPage.waitForSelector('input[name="username"]');
      await globalPage.focus('input[name="username"]');
      await globalPage.keyboard.type(INSTAGRAM_LOGIN);
      await globalPage.focus('input[name="password"]');
      await globalPage.keyboard.type(INSTAGRAM_PASSWORD);
      await globalPage.click('button[type="submit"]');
      await new Promise((r) => setTimeout(r, 1000));
    }
    await new Promise((r) => setTimeout(r, 60000));
  
  }


type instagramUser = {
    message: string;
    instagram_id : string | null;
    is_private : boolean;
};
export async function GET_INSTAGRAM_ID(target : string = ""): Promise<instagramUser>{
    let account = '';
    if (target.length > 0) {
      try{
        const response : HTTPResponse =  await globalPage.goto(
          `https://www.instagram.com/web/search/topsearch/?query=${target}`,
          { waitUntil: "networkidle0" }
        );
        const userProfileHtml : string = await globalPage.content();
        let $userProfile = cheerio.load(userProfileHtml);
        $userProfile('html').first().each((i, el) => {
        account = $userProfile(el).find('pre').text()
        });
        //create parsed object fail;
        const parsedUserProfileValue = JSON.parse(account);
        if(parsedUserProfileValue.status === "fail"){
            return {instagram_id : "" , message : parsedUserProfileValue.message , is_private : false}
        }
                //create parsed object useNotFound;
        else if(parsedUserProfileValue.users.length === 0){
          return {instagram_id : "" ,message : "Користувача не знайдено!Спробуйте ще раз!Викорстайтк5 команду /find у меню" ,  is_private : false};
        }
        const id : string = t(parsedUserProfileValue, 'users[0].user.pk').safeObject;
        const isPrivate : boolean = t(parsedUserProfileValue, 'users[0].user.is_private').safeObject;
        if(!isPrivate){
          return {instagram_id : id , message : "Користувач знайдено!Зачекайте ще декілька секунд" ,  is_private : false};

      }
        else{
          return {
            instagram_id : "" ,is_private: true , message : "Аккаунт приватний! Наразі ця функція недоступна" };
        }
      }
      catch(error){
        return error;
      }
       
    }
   
   
}
export async function GET_INITIAL_FOLLOWINGS(id : string = ''){
  const followings_number_limit = 49;
      let followings = '';
      if (id.length > 0) {
        try{
          const response : HTTPResponse  | null = await globalPage.goto(
            `https://www.instagram.com/graphql/query/?query_hash=58712303d941c6855d4e888c5f0cd22f&variables={"id":"${id}", "first": "${followings_number_limit}"}`,
            { waitUntil: "networkidle0" })
            if(response){
              const userFollowingsHtml : string = await globalPage.content();
              let $ = cheerio.load(userFollowingsHtml);
              $('html').each((i, el) => {
                followings = $(el).find('pre').text()
              });
              const parsedFollowings : Object = JSON.parse(followings);
              const nodes_followings : Array<string> = t(parsedFollowings, 'data.user.edge_follow.edges').safeObject;
              const usernames = []; 
                  for(let i = 0; i < nodes_followings.length; i++ ){
                    let username = t(nodes_followings[i], 'node.username').safeObject;
                    usernames.push(username)
                  }
                  return usernames;
            }
            else {
              return Error;
            }
          
    
        }
        catch(error){
          return error;
        }
      }
      
}






