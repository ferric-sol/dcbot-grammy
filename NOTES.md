## Local Testing

1. `vercel dev`
2. `ngrok http 3000`
3. `curl -X POST https://api.telegram.org/bot6699648946:AAEQWwPSeyzSBQCGQewCt1PPfZa-VWq7sQQ/setWebhook -H "Content-type: application/json" -d '{"url": "https://9330-136-57-20-238.ngrok.io/api/bot"}'`

   - replace the ending url with the url generated from step 2
   - to point the bot back to vercel use `curl -X POST https://api.telegram.org/bot6699648946:AAEQWwPSeyzSBQCGQewCt1PPfZa-VWq7sQQ/setWebhook -H "Content-type: application/json" -d '{"url": "https://dcbot-grammy.vercel.app/api/bot"}'`
   - Possibily point to `refactorCommands` branch? `curl -X POST https://api.telegram.org/bot6699648946:AAEQWwPSeyzSBQCGQewCt1PPfZa-VWq7sQQ/setWebhook -H "Content-type: application/json" -d '{"url": "https://dcbot-grammy-git-refactorcommands-ferric.vercel.app/api/bot?branch=refactorCommands"}'`

## Left off

Need to get swap tx return data for return message on telegram

vm execute error on simulate tx
