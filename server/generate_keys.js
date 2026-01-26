import webpush from 'web-push';
import fs from 'fs';

const vapidKeys = webpush.generateVAPIDKeys();

const content = `NEXT_PUBLIC_KEY=${vapidKeys.publicKey}\nNEXT_PRIVATE_KEY=${vapidKeys.privateKey}`;
fs.writeFileSync('keys_utf8.txt', content, 'utf8');
