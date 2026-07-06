# Pronouns.sbs
Your new favorite pronouns sharing app!

## What is this app for?
Its basicly a slight copy of pronouns.cc but its more up-to-date and actualy has more profile customizability than it, so you can share your pronouns and flags in a cooler way if you want!

## How can I host this app?
This app isnt supposed to be ran via vercel or simmalar, this app is built to be put on a server and then the data from the pm2 server tunnled through a Cloudflare Tunnel or simmalar.

### What you need to host the app:
- A linux baised server
- A Good speed internet/ethernet connection to said server
- pm2
- npm
- nodejs
- git

### How to set it up:
Onece you have all of those dependencies installed, just run this oneliner command to get the app set up:

``git clone https://github.com/arc360alt/pronouns.git && cd pronouns && ./deploy.sh``

After that is ran, the server should automaticly start and if you set up a cloudflare tunnel to host the contents of ``http://your.local.ip.here:3012`` you will see the website at that domain.

### I dont know why you would want to host this app for yourself but yeah theres the instructions.