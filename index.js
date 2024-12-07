require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class TournamentBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildMembers
            ]
        });

        this.logChannelId = null;
        this.verifiedRoleId = null;
        this.euRoleId = process.env.EU_ROLE_ID;
        this.verifyChannelId = process.env.VERIFY_CHANNEL_ID;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.client.on('ready', () => {
            console.log(`Logged in as ${this.client.user.tag}`);
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            switch (interaction.commandName) {
                case 'setup':
                    await this.handleSetupCommand(interaction);
                    break;
                case 'check-player':
                    await this.handleCheckPlayerCommand(interaction);
                    break;
                case 'check-all':
                    await this.handleCheckAllCommand(interaction);
                    break;
            }
        });

        this.client.on('messageReactionAdd', async (reaction, user) => {
            if (
                reaction.emoji.name === '✅' && 
                reaction.message.channel.id === this.verifyChannelId
            ) {
                await this.verifyPlayer(reaction.message.guild, user);
            }
        });
    }

    async handleSetupCommand(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: 'Only administrators can use this command.',
                ephemeral: true
            });
        }

        const logChannel = interaction.options.getChannel('log-channel');
        const verifiedRole = interaction.options.getRole('verified-role');

        this.logChannelId = logChannel.id;
        this.verifiedRoleId = verifiedRole.id;

        const setupEmbed = new EmbedBuilder()
            .setTitle('Tournament Bot Setup')
            .setDescription('Bot configuration updated successfully')
            .addFields(
                { name: 'Log Channel', value: `<#${logChannel.id}>`, inline: true },
                { name: 'Verified Role', value: `<@&${verifiedRole.id}>`, inline: true }
            )
            .setColor('#00FF00');

        await interaction.reply({ embeds: [setupEmbed], ephemeral: true });

        const logChannelObj = interaction.guild.channels.cache.get(this.logChannelId);
        if (logChannelObj) {
            await logChannelObj.send({ embeds: [setupEmbed] });
        }
    }

    async handleCheckPlayerCommand(interaction) {
        await interaction.deferReply();

        const discordUser = interaction.options.getUser('discord');
        const beatleaderId = interaction.options.getString('beatleader-id');
        const beatleaderName = interaction.options.getString('beatleader-name');

        let playerInfo;
        try {
            if (discordUser) {
                playerInfo = await this.getBeatleaderInfoByDiscord(discordUser);
            } else if (beatleaderId) {
                playerInfo = await this.getBeatleaderInfoById(beatleaderId);
            } else if (beatleaderName) {
                playerInfo = await this.getBeatleaderInfoByName(beatleaderName);
            } else {
                return interaction.editReply('Please provide at least one player identifier.');
            }

            const playerEmbed = new EmbedBuilder()
                .setTitle(`Beatleader Player Information`)
                .setThumbnail(playerInfo.profilePicture)
                .addFields(
                    { name: 'Name', value: playerInfo.name, inline: true },
                    { name: 'Global Rank', value: `#${playerInfo.rank}`, inline: true },
                    { name: 'Country Rank', value: `#${playerInfo.countryRank}`, inline: true },
                    { name: 'Country', value: playerInfo.country, inline: true },
                    { name: 'Is EU Player', value: playerInfo.isEU ? '✅ Yes' : '❌ No', inline: true }
                )
                .setColor(playerInfo.isEU ? '#00FF00' : '#FF0000');

            await interaction.editReply({ embeds: [playerEmbed] });

            const logChannel = this.client.channels.cache.get(this.logChannelId);
            if (logChannel) {
                await logChannel.send({ embeds: [playerEmbed] });
            }

        } catch (error) {
            await interaction.editReply(`Error retrieving player information: ${error.message}`);
        }
    }

    async handleCheckAllCommand(interaction) {
        await interaction.deferReply();

        try {
            const guild = interaction.guild;
            const euRole = guild.roles.cache.get(this.euRoleId);
            
            if (!euRole) {
                return interaction.editReply('EU role not found.');
            }

            const membersWithRole = euRole.members;
            const playerChecks = [];

            for (const [, member] of membersWithRole) {
                try {
                    const playerInfo = await this.getBeatleaderInfoByDiscord(member.user);
                    playerChecks.push(`<@${member.id}> : ${playerInfo.name} : ${playerInfo.isEU}`);
                } catch {
                    playerChecks.push(`<@${member.id}> : Unknown : Error checking`);
                }
            }

            const checkAllEmbed = new EmbedBuilder()
                .setTitle('EU Role Player Check')
                .setDescription(playerChecks.join('\n'))
                .setColor('#0099FF');

            await interaction.editReply({ embeds: [checkAllEmbed] });

            const logChannel = this.client.channels.cache.get(this.logChannelId);
            if (logChannel) {
                await logChannel.send({ embeds: [checkAllEmbed] });
            }

        } catch (error) {
            await interaction.editReply(`Error checking players: ${error.message}`);
        }
    }

    async verifyPlayer(guild, user) {
        const verifiedRole = guild.roles.cache.get(this.verifiedRoleId);
        const member = await guild.members.fetch(user.id);

        if (verifiedRole) {
            await member.roles.add(verifiedRole);

            const logChannel = this.client.channels.cache.get(this.logChannelId);
            if (logChannel) {
                const verifyEmbed = new EmbedBuilder()
                    .setTitle('Player Verified')
                    .setDescription(`<@${user.id}> verified successfully`)
                    .setColor('#00FF00');
                
                await logChannel.send({ embeds: [verifyEmbed] });
            }
        }
    }

    async getBeatleaderInfoByDiscord(user) {
        try {
            const response = await fetch(`https://api.beatleader.xyz/player/discord/${user.id}`);
            if (!response.ok) throw new Error('Failed to fetch player info');
            
            const playerData = await response.json();
            return {
                name: playerData.name,
                profilePicture: playerData.avatar,
                rank: playerData.rank,
                countryRank: playerData.countryRank,
                country: playerData.country,
                isEU: this.isEUCountry(playerData.country)
            };
        } catch (error) {
            console.error('Error fetching Discord player info:', error);
            throw error;
        }
    }

    async getBeatleaderInfoById(beatleaderId) {
        try {
            const response = await fetch(`https://api.beatleader.xyz/player/${beatleaderId}`);
            if (!response.ok) throw new Error('Failed to fetch player info');
            
            const playerData = await response.json();
            return {
                name: playerData.name,
                profilePicture: playerData.avatar,
                rank: playerData.rank,
                countryRank: playerData.countryRank,
                country: playerData.country,
                isEU: this.isEUCountry(playerData.country)
            };
        } catch (error) {
            console.error('Error fetching player by ID:', error);
            throw error;
        }
    }

    async getBeatleaderInfoByName(beatleaderName) {
        try {
            const response = await fetch(`https://api.beatleader.xyz/players?search=${encodeURIComponent(beatleaderName)}`);
            if (!response.ok) throw new Error('Failed to fetch player info');
            
            const playerResults = await response.json();
            const playerData = playerResults.data[0];

            return {
                name: playerData.name,
                profilePicture: playerData.avatar,
                rank: playerData.rank,
                countryRank: playerData.countryRank,
                country: playerData.country,
                isEU: this.isEUCountry(playerData.country)
            };
        } catch (error) {
            console.error('Error fetching player by name:', error);
            throw error;
        }
    }

    isEUCountry(countryCode) {
        const euCountries = [
            'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 
            'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 
            'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 
            'SI', 'ES', 'SE'
        ];
        return euCountries.includes(countryCode.toUpperCase());
    }

    start() {
        this.client.login(process.env.TOKEN);
    }
}

const bot = new TournamentBot();
bot.start();