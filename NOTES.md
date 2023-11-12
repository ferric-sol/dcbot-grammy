## Local Testing

1. `vercel dev`
2. `ngrok http 3000`
3. `curl -X POST https://api.telegram.org/bot6699648946:AAEQWwPSeyzSBQCGQewCt1PPfZa-VWq7sQQ/setWebhook -H "Content-type: application/json" -d '{"url": "https://9330-136-57-20-238.ngrok.io/api/bot"}'`

   - replace the ending url with the url generated from step 2
   - to point the bot back to vercel use `curl -X POST https://api.telegram.org/bot6699648946:AAEQWwPSeyzSBQCGQewCt1PPfZa-VWq7sQQ/setWebhook -H "Content-type: application/json" -d '{"url": "https://dcbot-grammy.vercel.app/api/bot"}'`
   - Possibily point to `refactorCommands` branch? `curl -X POST https://api.telegram.org/bot6699648946:AAEQWwPSeyzSBQCGQewCt1PPfZa-VWq7sQQ/setWebhook -H "Content-type: application/json" -d '{"url": "https://dcbot-grammy-git-refactorcommands-ferric.vercel.app/api/bot?branch=refactorCommands"}'`

## Left off

### 23/11/11

Ensuring the user has enough SALT before attempting the swap

Details: wrong transaction nonce <-- Current error

Have to figure out why the transaction nonce is incorrect, possibly need to provide it manually to the send transaction
