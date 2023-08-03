const { Client, EmbedBuilder } = require("discord.js");
const { randomInt } = require("crypto");
const client = new Client({
    intents: 4194303
});
const config = require("./config.json");
const Users = require("./users.json");
const fs = require("fs");
const resetPassword = randomInt(10000000000000, 99999999999999);
console.log(`The Password to Reset is ${resetPassword}`);
const submitLinkRegex = /submit ([\w\s\d]+) (https:\/\/elestralsdb\.com\/decks\/[\da-f]+)?/i; //regexr.com/7hqgu
const subtractRegex = /subtract ([\.\w\d]+) (\d)/i; //regexr.com/7hqhv
const addRegex = /add ([\.\w\d]+) (\d)/i;
const reportRegex = /report (\d)-(\d)/i; //regexr.com/7hqi5
const statsRegex = /stats ([\.\w]+)/i;
const banRegex = /ban ([\.\w]+)/i;
const unbanRegex = /unban ([\d]+)/i;
const currentRunRegex = /current ([\.\w]+)/i;

client.on("ready", () => {
    console.log("I am ready!");
    client.channels.cache.get('1026185954656014356').send("Back online!");
});

const prefix = config.prefix;
client.on("messageCreate", (message) => {
    //return if message was sent by a bot
    if(message.author.bot) {
        return;
    }
    //return if message doesn't start with the prefix (currently "!")
    if (!message.content.startsWith(prefix)) {
        return;
    }
    //stop banned players
    if(Users.banlist.contains(message.author.id) && !JSON.parse(JSON.stringify(message.member)).roles.contains("1026186647831846922")) {
        return;
    }
    
    //return the ping (smth is very wrong with this (it printed -600 ping one time))
    // if (message.content.toUpperCase().trim() == `${prefix}PING`) {
    //     let ping = Date.now() - message.createdTimestamp;
    //     message.channel.send(`Pong!\n${ping}ms`);
    //     console.log(`Ping from ${message.author.username}#${message.author.discriminator}/${message.author.globalName}, ${ping}ms`);
    //     return;
    // }
    
    //help command
    if (message.content.toUpperCase().trim() == `${prefix}HELP`) {
        let helpMessages = [
            "!Submit to submit a decklist and start playing!",
            "!Leaderboard to view the leaderboard.",
            "!Report to report a match.",
            "!Foes to see who you can face.",
            "!Stats to view a player's stats.",
            "!Current to view a player's current run's stats."
        ];
        message.channel.send(`Use ![command] to see how to use a command.\n\`\`\`${helpMessages.join("\n")}\`\`\``);
        return;
    }
    
    //show the leaderboard
    if (message.content.toUpperCase().trim() == `${prefix}LEADERBOARD`) {
        const allPoints = [];
        Users.users.forEach(Player => {
            let playersPoints = 0;
            if((Player.finishedRuns.length+!!Player.currentRun)<=config.bestRunCount) {
                Player.finishedRuns.forEach(finishedRun => {
                    playersPoints += finishedRun.points;
                });
                if(Player.currentRun) {
                    playersPoints += Player.currentRun.points;
                }
            } else {
                const playersPointsArray = [];
                Player.finishedRuns.forEach(finishedRun => {
                    playersPointsArray.push(finishedRun.points);
                });
                if(Player.currentRun) {
                    playersPointsArray.push(Player.currentRun.points);
                }
                playersPointsArray.sort(compareNumbers);
                for (let i = 0; i < config.bestRunCount; i++) {
                    playersPoints += playersPointsArray[i];
                }
            }
            allPoints.push([Player.USERNAME, playersPoints]);
        });
        allPoints.sort((a, b) => b[1] - a[1]);
        while(allPoints.length > 10) { allPoints.pop(); }        
        let count = 0;
        message.channel.send(`\`\`\`Leaderboard:\n${allPoints.map(i => `${++count}: ${i[0]} (${i[1]} points)`).join("\n")}\`\`\``);
        return;
    }
    
    //show a player's stats
    if (message.content.toUpperCase().trim().startsWith(`${prefix}STATS`)) {
        const m = statsRegex.exec(message.content.trim());
        if(!m) {
            message.channel.send("View a player's stats with \`!stats [username]\`");
            return;
        }
        if(!findUserUsingUSERNAME(m[1])) {
            message.channel.send("That user does not exist."); 
            return;
        }
        const player = findUserUsingUSERNAME(m[1]);
        const playerPoints = [];
        player.finishedRuns.forEach(run => {
            if(run.points != 0) {
                playerPoints.push([run.deckname, run.decklist, run.points]);
            }
        });
        if(player.currentRun) {
            if(player.currentRun.points != 0) {
                playerPoints.push([player.currentRun.deckname, player.currentRun.decklist, player.currentRun.points]);
            }
        }
        playerPoints.sort((a, b) => b[2] - a[2]);
        while(playerPoints.length > 10) { playerPoints.pop(); }
        message.channel.send(`\`\`\`${m[1]}'s Stats:\n${playerPoints.map(i => `${i[0]}: ${i[2]} Points (${i[1]})`).join("\n")}\`\`\``);
    }
    
    //start a new run
    if (message.content.toUpperCase().trim().startsWith(`${prefix}SUBMIT`)) {
        const m = submitLinkRegex.exec(message.content.trim()+" ");
        if(!m) {
            message.channel.send(`Start a run with \`!submit deckname https://elestralsdb.com/decks/############\` or \`!submit deckname\` and attach an image. (Only one image.)`);
            return;
        }
        let decklistAttachment = null;
        if(message.attachments.first()) {
            decklistAttachment = message.attachments.first().url;
        }
        if(m[2]) {
            decklistAttachment = m[2];
        } 
        if(!decklistAttachment) {
            message.channel.send("Please attach an image of a deck or an https://elestralsdb.com deck link");
            return;
        }
        if(findUserUsingID(message.author.id)) {
            const player = findUserUsingID(message.author.id);
            const playersRun = player.currentRun;
            const playersFiniRuns = player.finishedRuns;
            if(playersRun) {
                playersFiniRuns.push({
                    "points": playersRun.points,
                    "deckname": playersRun.deckname,
                    "decklist": playersRun.decklist,
                    "number": playersRun.number
                });
            }
            player.currentRun = {
                "points": 0,
                "opponents": [],
                "deckname": m[1],
                "decklist": decklistAttachment,
                "number": playersFiniRuns[playersFiniRuns.length - 1].number + 1
            };
        } else {
            Users.users.push({
                "USERID": message.author.id, 
                "USERNAME": message.author.username,
                "finishedRuns": [],
                "currentRun": {
                    "points": 0,
                    "opponents": [],
                    "deckname": m[1],
                    "decklist": decklistAttachment,
                    "number": 0
                }
            });
            console.log(`Created User ${message.author.username}(${message.author.id}).`);
        }
        console.log(`User ${message.author.username}(${message.author.id}) started a new run using ${decklistAttachment}.`);
        message.channel.send(`<@${message.author.id}> has started a new run!`);
        UpdateUsers();
        return;
    }
    
    //report a bo3 match
    //console.log(message.mentions.users.first().id);
    if (message.content.toUpperCase().trim().startsWith(`${prefix}REPORT`)) {
        let m = reportRegex.exec(message.content.trim());
        if(!m) {
            message.channel.send(`Report a match with \`!report #-# @opponent\`. #-# is the score of the Bo3 (The first number being the reporters score and the second being the opponents). So a score of 2-0 means the user reporting the match was the winner while 0-2 means the opponent was the winner.`);
            return;
        }
        if(!findUserUsingID(message.author.id)) {
            message.channel.send(`You do not have an ongoing run.\nStart a run with \`!submit deckname https://elestralsdb.com/decks/############\` or \`!submit deckname\` and attach an image.`);
            return;
        }
        if(!findUserUsingID(message.author.id).currentRun) {
            message.channel.send(`You do not have an ongoing run.\nStart a run with \`!submit deckname https://elestralsdb.com/decks/############\` or \`!submit deckname\` and attach an image.`);
            return;
        }
        if(!message.mentions.users.first()) {
            message.channel.send(`Please mention who your opponent was.`);
            return;
        }
        if(!findUserUsingID(message.mentions.users.first().id)) {
            message.channel.send(`Your opponent has not started a run.`);
            return;
        }
        if(!findUserUsingID(message.mentions.users.first().id).currentRun) {
            message.channel.send(`Your opponent has not started a run.`);
            return;
        }
        if(findUserUsingID(message.author.id).currentRun.opponents.contains(`${findUserUsingID(message.mentions.users.first().id).USERNAME}${findUserUsingID(message.mentions.users.first().id).currentRun.number}`)) {
            message.channel.send(`You've already faced this opponent in this run.`);
            return;
        }
        if(findUserUsingID(message.mentions.users.first().id).currentRun.opponents.contains(`${findUserUsingID(message.author.id).USERNAME}${findUserUsingID(message.author.id).currentRun.number}`)) {
            message.channel.send(`Your opponent has already faced you in their run.`);
            return;
        }
        findUserUsingID(message.author.id).currentRun.opponents.push(`${findUserUsingID(message.mentions.users.first().id).USERNAME}${findUserUsingID(message.mentions.users.first().id).currentRun.number}`);
        findUserUsingID(message.mentions.users.first().id).currentRun.opponents.push(`${findUserUsingID(message.author.id).USERNAME}${findUserUsingID(message.author.id).currentRun.number}`);
        if(m[1] > m[2]) {
            findUserUsingID(message.author.id).currentRun.points += 1;
            message.channel.send(`<@${message.author.id}> Recorded match, ${message.author.username} wins ${m[1]} - ${m[2]} over ${findUserUsingID(message.mentions.users.first().id).USERNAME}`);
            fs.appendFileSync("./matches.log", `${Date.now()} ${message.author.username} wins ${m[1]} - ${m[2]} over ${findUserUsingID(message.mentions.users.first().id).USERNAME}\n`);
        } else {
            findUserUsingID(message.mentions.users.first().id).currentRun.points +=1;
            message.channel.send(`<@${message.author.id}> Recorded match, ${findUserUsingID(message.mentions.users.first().id).USERNAME} wins ${m[2]} - ${m[1]} over ${message.author.username}`);
            fs.appendFileSync("./matches.log", `${Date.now()} ${findUserUsingID(message.mentions.users.first().id).USERNAME} wins ${m[2]} - ${m[1]} over ${message.author.username}\n`);
        }
        if(findUserUsingID(message.author.id).currentRun.opponents.length >= 5) {
            if(findUserUsingID(message.author.id).currentRun.points >= 5) {
                findUserUsingID(message.author.id).currentRun.points++;
                client.channels.cache.get('1026185954656014356').send(`${message.author.username} has completed a perfect run with ${findUserUsingID(message.author.id).currentRun.decklist}`);
            }
            message.channel.send(`Run completed with ${findUserUsingID(message.author.id).currentRun.points} points!`);
            console.log(`${message.author.username} completed a run with ${findUserUsingID(message.author.id).currentRun.points} points`);
            findUserUsingID(message.author.id).finishedRuns.push({
                "points": findUserUsingID(message.author.id).currentRun.points,
                "deckname": findUserUsingID(message.author.id).currentRun.deckname,
                "decklist": findUserUsingID(message.author.id).currentRun.decklist,
                "number": findUserUsingID(message.author.id).currentRun.number
            });
            findUserUsingID(message.author.id).currentRun = null;
        }
        if(findUserUsingID(message.mentions.users.first().id).currentRun.opponents.length >= 5) {
            if(findUserUsingID(message.mentions.users.first().id).currentRun.points >= 5) {
                findUserUsingID(message.mentions.users.first().id).currentRun.points++;
                client.channels.cache.get('1026185954656014356').send(`${findUserUsingID(message.mentions.users.first().id).USERNAME} has completed a perfect run with ${findUserUsingID(message.mentions.users.first().id).currentRun.decklist}`);
            }
            message.channel.send(`Run completed with ${findUserUsingID(message.mentions.users.first().id).currentRun.points} points!`);
            console.log(`${findUserUsingID(message.mentions.users.first().id).USERNAME} completed a run with ${findUserUsingID(message.mentions.users.first().id).currentRun.points} points`);
            findUserUsingID(message.mentions.users.first().id).finishedRuns.push({
                "points": findUserUsingID(message.mentions.users.first().id).currentRun.points,
                "deckname": findUserUsingID(message.mentions.users.first().id).currentRun.deckname,
                "decklist": findUserUsingID(message.mentions.users.first().id).currentRun.decklist,
                "number": findUserUsingID(message.author.id).currentRun.number
            });
            findUserUsingID(message.mentions.users.first().id).currentRun = null;
        }
        UpdateUsers();
        return;
    }
    
    //report who you can face
    if (message.content.toUpperCase().trim() == `${prefix}FOES`) {
        if(!findUserUsingID(message.author.id)) {
            message.channel.send(`You do not have an ongoing run.\nStart a run with \`!submit deckname https://elestralsdb.com/decks/############\` or \`!submit deckname\` and attach an image.`);
            return;
        }
        if(!findUserUsingID(message.author.id).currentRun) {
            message.channel.send(`You do not have an ongoing run.\nStart a run with \`!submit deckname https://elestralsdb.com/decks/############\` or \`!submit deckname\` and attach an image.`);
            return;
        }
        let userExisted = false;
        Users.users.forEach(object => {
            if(object.USERID == message.author.id) {
                userExisted = true;  
                let played = "";
                let unPlayed = "";
                let playedCount = 0;
                let unPlayedCount = 0;
                let playedCounting = 0;
                let unPlayedCounting = 0;
                Users.users.forEach(element => {
                    if(element.currentRun) {
                        if(object.currentRun.opponents.contains(`${element.USERNAME}${element.currentRun.number}`) && object.USERID != element.USERID) {
                            playedCount++;
                        } else if (object.USERID != element.USERID) {
                            unPlayedCount++;
                        }
                    }
                });
                Users.users.forEach(element => {
                    if(element.currentRun) {
                        if(object.currentRun.opponents.contains(`${element.USERNAME}${element.currentRun.number}`) && object.USERID != element.USERID) {
                            playedCounting++;
                            if(played != "") {
                                played += ", ";
                            }
                            if(played != "" && playedCounting == playedCount) {
                                played += "and ";
                            }
                            played += element.USERNAME;
                        } else if (object.USERID != element.USERID) {
                            unPlayedCounting++;
                            if(unPlayed != "") {
                                unPlayed += ", ";
                            }
                            if(unPlayed != "" && unPlayedCounting == unPlayedCount) {
                                unPlayed += "and ";
                            }
                            unPlayed += element.USERNAME;
                        }
                    }
                });
                if(played == "") {
                    played = "No-one"
                }
                if(unPlayed == "") {
                    unPlayed = "No-one"
                }
                played += ".";
                unPlayed += ".";
                message.channel.send(`<@${message.author.id}>'s Foes:\nYou have already played: ${played}\nThe following players are able to be played: ${unPlayed}`);
            }
        });
        if(!userExisted) {
            message.channel.send(`You do not have an ongoing run.\nStart a run with \`!submit deckname https://elestralsdb.com/decks/############\` or \`!submit deckname\` and attach an image.`);
        }
        return;
    }
    
    //print info about a player's current run
    if (message.content.toUpperCase().trim().startsWith(`${prefix}CURRENT`)) {
        const m = currentRunRegex.exec(message.content.trim());
        if(!m) {
            message.channel.send(`Look up a player's current run's stats with \`!Current playername\`.`);
            return;
        }
        if(!findUserUsingUSERNAME(m[1])) {
            message.channel.send(`That user does not exist.`);
            return;
        }
        if(!findUserUsingUSERNAME(m[1]).currentRun) {
            message.channel.send(`That user does not have an ongoing run.`);
            return;
        }
        const playersRun = findUserUsingUSERNAME(m[1]).currentRun;
        const runEmbed = new EmbedBuilder()
            .setColor(randomInt(0, 0xFFFFFF))
            .setTitle(`${m[1]}'s Current Run`)
            .setDescription(`${5 - playersRun.opponents.length} Matches Left\n${playersRun.points} Points`)
            .setURL(playersRun.decklist);
        message.channel.send({ embeds: [runEmbed] });
    }

    //admin commands
    JSON.parse(JSON.stringify(message.member)).roles.forEach(roleID => {
        if (roleID === "1026186647831846922") {
            //message.channel.send("Ranked Moderator sent this command"); 
            //reset all user data (Users.users = [])
            if (message.content.toUpperCase().trim() == `${prefix}RESET YES REALLY RESET EVERYTHING PASSWORD ${resetPassword}`) {
                ResetUsers(message);
                return;
            }
            
            //subtract from a user's score
            if (message.content.toUpperCase().trim().startsWith(`${prefix}SUBTRACT`)) {
                let m = subtractRegex.exec(message.content.trim());
                if(!m) {
                    message.channel.send("\`!subtract username #\` to subtract # from username's current run score.");
                }
                let foundUsername = false;
                Users.users.forEach(object => {
                    if(object.USERNAME == m[1]) {
                        foundUsername = true;
                        if(object.currentRun) {
                            object.currentRun.points -= parseInt(m[2]);
                            console.log(`${message.author.username} subtracted ${m[2]} from ${m[1]}'s current run score.`);
                            message.channel.send(`Subtracted ${m[2]} from ${m[1]}'s current run score.`);
                        } else {message.channel.send(`${object.USERNAME} does not have an ongoing run.`);}
                    }
                });
                if(!foundUsername) {
                    message.channel.send(`Could not find that username.`);
                }
                UpdateUsers();
                return;
            }
            //add to a user's score
            if (message.content.toUpperCase().trim().startsWith(`${prefix}ADD`)) {
                let m = addRegex.exec(message.content.trim());
                if(!m) {
                    message.channel.send("\`!add username #\` to add # to username's current run score.");
                    return;
                }
                let foundUsername = false;
                Users.users.forEach(object => {
                    if(object.USERNAME == m[1]) {
                        foundUsername = true;
                        if(object.currentRun) {
                            object.currentRun.points += parseInt(m[2]);
                            console.log(`${message.author.username} added ${m[2]} to ${m[1]}'s current run score.`);
                            message.channel.send(`Added ${m[2]} to ${m[1]}'s current run score.`);
                        } else {message.channel.send(`${object.USERNAME} does not have an ongoing run.`);}
                    }
                });
                if(!foundUsername) {
                    message.channel.send(`Could not find that username.`);
                }
                UpdateUsers();
                return;
            }
            
            //BAN
            if (message.content.toUpperCase().trim().startsWith(`${prefix}BAN`)) {
                let m = banRegex.exec(message.content.trim());
                if(!m) {
                    message.channel.send("You need to specify a person to ban.");
                    return;
                }
                if(!findUserUsingUSERNAME(m[1])) {
                    message.channel.send("That user doesn't exist.");
                    return;
                }
                let offendingPlayer = findUserUsingUSERNAME(m[1]);
                Users.banlist.push(offendingPlayer.USERID);
                let indexOfOffender = Users.users.indexOf(offendingPlayer);
                Users.users.splice(indexOfOffender, 1);
                UpdateUsers();
                console.log(`${m[1]} was banned by ${message.author.username}.`);
                message.channel.send(`Successfully banned ${m[1]}.`);
                return;
            }
            
            //unban
            if (message.content.toUpperCase().trim().startsWith(`${prefix}UNBAN`)) {
                let m = unbanRegex.exec(message.content.trim());
                if(!m) {
                    message.channel.send("You need to specify an id to unban.");
                    return;
                }
                Users.banlist.splice(Users.banlist.indexOf(m[1]), 1);
                UpdateUsers();
                console.log(`${m[1]} was unbanned by ${message.author.username}.`);
                message.channel.send(`Successfully unbanned <@${m[1]}>.`);
                return;
            }
        }
    });
});

function findUserUsingID(id) {
    let temp = null;
    Users.users.forEach(object => {
        if(object.USERID == id.toString()) {
            temp = object;
        }
    });
    return temp;
}

function findUserUsingUSERNAME(USERNAME) {
    let temp = null;
    Users.users.forEach(object => {
        if(object.USERNAME == USERNAME) {
            temp = object;
        }
    });
    return temp;
}

function UpdateUsers() {
    fs.writeFileSync("./users.json", JSON.stringify(Users));
}

function ResetUsers(message) {
    message.channel.send("Reset all user data.");
    console.log(`${message.author.username}(${message.author.id}) RESET ALL USER DATA`);
    Users.users = [];
    UpdateUsers();
}

Array.prototype.contains = function(obj) {
    var i = this.length;
    while (i--) {
        if (this[i] === obj) {
            return true;
        }
    }
    return false;
}

function compareNumbers(a, b) {
    return b - a;
}

client.login(config.token);