require('dotenv').config();
const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const commands = [
    {
        name: 'setup',
        description: 'Set up the tournament verification bot',
        options: [
            {
                name: 'log-channel',
                type: ApplicationCommandOptionType.Channel,
                description: 'Channel for bot logs',
                required: true
            },
            {
                name: 'verified-role',
                type: ApplicationCommandOptionType.Role,
                description: 'Role given to verified players',
                required: true
            }
        ]
    },
    {
        name: 'check-player',
        description: 'Check a player\'s Beatleader information',
        options: [
            {
                name: 'discord',
                type: ApplicationCommandOptionType.User,
                description: 'Discord user to check',
                required: false
            },
            {
                name: 'beatleader-id',
                type: ApplicationCommandOptionType.String,
                description: 'Beatleader ID to check',
                required: false
            },
            {
                name: 'beatleader-name',
                type: ApplicationCommandOptionType.String,
                description: 'Beatleader username to check',
                required: false
            }
        ]
    },
    {
        name: 'check-all',
        description: 'Check all players with the EU role'
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Registering slash commands...');

        await rest.put(
            Routes.applicationGuildCommands(process.env.clientID, process.env.guildID),
            { body: commands }
        );

        console.log('Slash commands were registered successfully!');
    } catch (error) {
        console.log(`There was an error: ${error}`);
    }
})();