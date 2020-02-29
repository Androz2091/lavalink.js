'use strict';

const { Client } = require('discord.js');
const { PlayerInstance, request } = require('../../index');

class MusicClient extends Client {
    /**
     * @constructor
     */
    constructor () {
        super();

        this.config = require('./config');
    }
}

const client = new MusicClient({
    disableEveryone: true
});

client.on('ready', () => {
    client.player = new PlayerInstance(client, client.config.music, {
        clientID: client.user.id,
        shardCount: 1
    });

    console.info('Bot ready!');
});
client.on('message', async message => {
    if (message.channel.type === 'dm' || message.author.bot) {
        return;
    }

    const prefix = client.config.prefix;
    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if (command === 'join') {
        if (!message.member.voice.channel) {
            return message.channel.send('You have to be connected to a voice channel first.');
        }

        await client.player.join({
            host: client.player.serversStorage.first().host,
            guildID: message.guild.id,
            channelID: message.member.voice.channel.id,
            deafen: true
        });

        message.channel.send(`Joined voice channel **${message.member.voice.channel}**!`);
    }
    if (command === 'leave' || command === 'stop') {
        if (!message.member.voice.channel) {
            return message.channel.send('You have to be connected to a voice channel first.');
        }
        
        const player = client.player.get(message.guild.id);

        if (!player) {
            return message.channel.send('I am not connected to a voice channel.');
        }

        const queue = player.getQueue();

        queue.splice(0, queue.length);
        client.player.leave(message.guild.id);
        message.channel.send(`Leaved voice channel **${message.member.voice.channel.name}**!`);
    }
    if (command === 'play') {
        if (!args.join(' ')) {
            return message.channel.send('Please provide valid arguments.');
        }
        if (!message.member.voice.channel) {
            return message.channel.send('You have to be connected to a voice channel first.');
        }

        await client.player.join({
            host: client.player.serversStorage.first().host,
            guildID: message.guild.id,
            channelID: message.member.voice.channel.id,
            deafen: true
        });

        const player = client.player.get(message.guild.id);
        const tracks = await request(client.player.servers[0], `ytsearch:${args.join(' ')}`);

        if (tracks.length === 0) {
            return message.channel.send('No track found, please try again.');
        }

        const track = tracks[0];
        const queue = player.getQueue();

        queue.push({
            author: message.author.id,
            loop: false,
            track: track.track,
            info: {
                id: track.info.identifier,
                title: track.info.title,
                author: track.info.author,
                duration: track.info.duration,
                link: track.info.uri
            }
        });

        if (queue.length > 1) {
            return message.channel.send(`I added **${track.info.title}** by **${track.info.author}** to the queue at position ${queue.length - 1}.`);
        }

        await play(message);
    }
    if (command === 'pause') {
        if (!message.member.voice.channel) {
            return message.channel.send('You have to be connected to a voice channel first.');
        }
        
        const player = client.player.get(message.guild.id);

        if (!player || player.isPaused) {
            return message.channel.send('I\'m not playing currenly.');
        }

        player.pause();

        message.channel.send('Song paused!');
    }
    if (command === 'resume') {
        if (!message.member.voice.channel) {
            return message.channel.send('You have to be connected to a voice channel first.');
        }
        
        const player = client.player.get(message.guild.id);

        if (!player) {
            return message.channel.send('I\'m not playing currenly.');
        }
        if (!player.isPaused) {
            return message.channel.send('The current track is not paused.');
        }

        player.resume();

        message.channel.send('Song resumed!');
    }
    if (command === 'skip') {
        if (!message.member.voice.channel) {
            return message.channel.send('You have to be connected to a voice channel first.');
        }
        
        const player = client.player.get(message.guild.id);

        if (!player || player.isPaused) {
            return message.channel.send('I\'m not playing currenly.');
        }

        player.skip();
    }
    if (command === 'volume') {
        if (!args[0]) {
            return message.channel.send('Please provide a valid volume to set!');
        }
        if (!message.member.voice.channel) {
            return message.channel.send('You have to be connected to a voice channel first.');
        }
        
        const player = client.player.get(message.guild.id);

        if (!player || player.isPaused) {
            return message.channel.send('I\'m not playing currenly.');
        }

        const oldVolume = player.state.volume;
        
        await player.setVolume(args[0], true);

        message.channel.send(`Volume set from **${oldVolume}%** to **${player.state.volume}%**!`);
    }
});

/**
 * Plays a song
 * @param {Object} message The message received by the message event
 * @returns {function} Loop with play function
 */
async function play (message) {
    const player = client.player.get(message.guild.id);
    const queue = player.getQueue();

    if (!player) {
        return;
    }

    await player.play(queue[0].track);
    player.on('error', () => {
        queue.splice(0, queue.length);
        client.player.leave(message.guild.id);

        return message.channel.send('An error occurred during track playing, I leaved the voice channel.');
    });
    player.on('end', async () => {
        if (!queue[0].loop) {
            queue.shift();
        }
        if (queue.length === 0 || message.guild.channels.cache.get(player.channelID).members.filter(member => member.user.id !== client.user.id).size === 0) {
            queue.splice(0, queue.length);
            return client.player.leave(message.guild.id);
        }

        await play(message);
    });

    message.channel.send({
        embed: {
            author: {
                name: queue[0].info.title,
                icon_url: `https://img.youtube.com/vi/${queue[0].info.id}/hqdefault.jpg`,
                url: queue[0].info.link
            },
            description: `Author: ${queue[0].info.author}`,
            image: {
                url: `https://img.youtube.com/vi/${queue[0].info.id}/hqdefault.jpg`
            },
            timestamp: new Date(),
            footer: {
                text: 'Music bot - Discord.js',
                icon_url: client.user.displayAvatarURL()
            }
        }
    });
}

client.login(client.config.token);
