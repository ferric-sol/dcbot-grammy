
import { Bot } from "grammy";

const token = process.env.TELEGRAM_API_KEY;
if (!token) throw new Error("BOT_TOKEN is unset");

const bot = new Bot(token);

export default async function setup() { 
  await bot.api.setMyCommands([
    { command: "start", description: "Start the fruit game, prove your identity with zupass and create a fully funded wallet" },
    { command: "balance", description: "Get your credit balance" },
    { command: "price_apple", description: "Get the price of an apple in credits" },
    { command: "price_strawberry", description: "Get the price of a strawberry in credits" },
    { command: "price_avocado", description: "Get the price of an avocado in credits" },
    { command: "price_banana", description: "Get the price of a banana in credits" },
    { command: "price_tomato", description: "Get the price of a tomato in credits" },
    { command: "price_lemon", description: "Get the price of a lemon in credits" },
    { command: "buy_apple", description: "Buy apples with credits" },
    { command: "buy_strawberry", description: "Buy strawberries with credits" },
    { command: "buy_avocado", description: "Buy avocados with credits" },
    { command: "buy_banana", description: "Buy bananas with credits" },
    { command: "buy_tomato", description: "Buy tomatoes with credits" },
    { command: "buy_lemon", description: "Buy lemons with credits" },
    //    { contractName: "AvocadoToken", name: "Avocado", emoji: "🥑" },
    //  { contractName: "BananaToken", name: "Banana", emoji: "🍌" },
    //  { contractName: "TomatoToken", name: "Tomato", emoji: "🍅" },
    //  { contractName: "StrawberryToken", name: "Strawberry", emoji: "🍓" },
    //  { contractName: "AppleToken", name: "Apple", emoji: "🍏" },
    //  { contractName: "LemonToken", name: "Lemon", emoji: "🍋" },
  ]);
}

setup();
