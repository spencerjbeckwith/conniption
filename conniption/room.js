const EventEmitter = require("events");
const Config = require("./config.js");
const Utility = require("./utility.js");
const Player = require("./player.js");
const Packet = require("./packet.js");
const RoomCommon = require("./roomcommon.js");
module.exports = class Room extends EventEmitter {
    constructor(name,creatorName,maxPlayers,passcode = "") {
        super();
        this.common = new RoomCommon(name,creatorName);
        this.passcode = passcode;
        this.maxPlayers = Math.min(maxPlayers,Config.get().MaxPlayersPerRoom);

        this.players = [];
        this.manager = undefined;

        if (this.eventFunction !== undefined) { //Set this via prototype if you want events
            this.eventFunction();
        }

        console.log(`New room "${this.common.name}" created with ID ${this.common.id}. Waiting for players...`);
        this.myTimeout = undefined;
        this.logicInterval = undefined;
        this.setEmptyTimeout();
    }

    /**
     * Invoke to remove this room from memory safely.
     */
    remove() {
        this.emit("remove");
        this.kickAll();
        if (this.common.inProgres) {
            this.endGame();
        }
        if (this.myTimeout !== undefined) {
            clearTimeout(this.myTimeout);
        }
        console.log(`Removed room "${this.common.name}" with ID ${this.common.id}.`);
    }

    /**
     * Invoked when a new player attempts to connect to this Room.
     * @param {String} name The name of the user who is trying to connect.
     * @param {String} passcode The Passcode needed to connect to the room.
     * @param {WebSocket} ws The WebSocket of the person connecting.
     * @param {String} ip The IP the connection is coming from.
     */
    addPlayer(name,passcode = "",ws,ip) {
        this.emit("beforeConnection",name,passcode,ws,ip);

        if (passcode != this.passcode) {
            throw `Incorrect passcode!`;
        }

        if (!Utility.nameIsValid(name)) {
            throw `Name "${name}" invalid! Must be ${Config.get().Users.Name.MinLength} to ${Config.get().Users.Name.MaxLength} characters long and must not contain any special characters.`;
        }

        for (let p = 0; p < this.players.length; p++) {
            let obj = this.players[p];
            if (!obj.common.connected) { //We looking for any reconnections?
                if (obj.common.name === name && obj.ip === ip && obj.room === this) {
                    console.log(`Player "${obj.common.name}" has reconnected to their Room, ID: ${this.common.id}`);
                    obj.found(ws);
                    this.sendSelf();
                    return obj;
                }
            }
        }

        if (!Config.get().AllowJoinInProgress && this.common.inProgress) {
            throw `Cannot join a Room in progress!`;
        }
        if (this.players.length >= this.maxPlayers) {
            throw `This Room is full!`;
        }
        if (Config.get().Users.MustHaveUniqueName) {
            for (let p = 0; p < this.players.length; p++) {
                if (name === this.players[p].common.name) {
                    throw `There is already somebody named ${name} connected to this Room.`;
                }
            }
        }
        if (Config.get().Users.MustHaveUniqueIP) {
            for (let p = 0; p < this.players.length; p++) {
                if (ip === this.players[p].ip) {
                    throw `Your IP is already connected to this Room as ${this.players[p].common.name}.`
                }
            }
        }

        if (this.getPlayer(ws) !== undefined) {
            throw `WebSocket already taken!`;
        }

        let player = new Player(name,ws,ip,this);
        this.players.push(player);
        ws.myRoom = this;
        ws.myPlayer = player;
        console.log(`Player "${player.common.name}" with ID ${player.common.id} and IP ${player.ip} has joined Room "${this.common.name}" with ID ${this.common.id}.`);
        if (this.common.host === name) { //Our host connected!
            this.setHost(player);
        }
        this.sendSelf(`${name} has connected!`);
        this.emit("afterConnection",player);
        return player;
    }

    /**
     * Returns a Player instance with the specified argument, if it is connected to this Room.
     * @param {Number|WebSocket} arg Either the ID or WebSocket of the Player you are trying to find.
     * @returns {Player} Returns the Player instance, or undefined if none is found.
     */
    getPlayer(arg) {
        let check;
        for (let p = 0; p < this.players.length; p++) {
            if (typeof arg === "number") {
                check = this.players[p].common.id;
            } else {
                check = this.players[p].ws;
            }

            if (check === arg) {
                return this.players[p];
            }
        }
        return undefined;
    }

    /**
     * Removes a player from a room's list and disconnects them.
     * @param {Player} player The player to remove.
     */
    removePlayer(player) {
        let index = this.players.indexOf(player);
        if (index !== -1) {
            this.emit("beforeRemovePlayer",player);
            player.remove();
            this.players.splice(index,1);

            if (this.getHost() === player.common.id) {
                this.findHost(player.common.name);
            }

            this.sendSelf(`${player.common.name} has disconnected.`);
            console.log(`Player "${player.common.name}" with ID ${player.common.id} and IP ${player.ip} has disconnected from Room "${this.common.name}" with ID ${this.common.id}.`);

            //Are we empty? Set our timeout?
            if (this.players.length === 0) {
                this.setEmptyTimeout();
            }
            this.emit("afterRemovePlayer",player);
        } else {
            console.warn(`Tried to remove a player that doesn't exist in the Room ID ${this.common.id}!`);
        }
    }

    /**
     * Invoked to marks a player as "lost", holding them in memory until they reconnect or their timer runs out.
     * @param {Player} player The player who lost their connection.
     */
    lostPlayer(player) {
        if (player !== undefined) {
            if (this.common.inProgress && Config.get().Users.AllowReconnection) {
                let timeoutSeconds = Config.get().Users.ReconnectionTimeout;
                console.log(`Player "${player.common.name}" has lost connection. They have ${timeoutSeconds} seconds to reconnect to their Room, ID: ${this.common.id}`);
                player.lost();
            } else {
                this.removePlayer(player);
            }
        } else {
            console.warn(`Tried to lose a player that doesn't exist in the Room ID ${this.common.id}!`);
        }
    }

    /**
     * Disconnects all players in this room.
     */
    kickAll() {
        for (let p = 0; p < this.players.length; p++) {
            this.players[p].kick();
        }
    }

    /**
     * Sets a new host for this Room.
     * @param {Player} player The Player instance to make the host.
    */
    setHost(player) {
        if (this.getHost() !== player.common.id) {
            //Unset our old host, if we had one.
            for (let p = 0; p < this.players.length; p++) {
                this.players[p].common.isHost = false;
            }
            if (player !== undefined) {
                this.common.host = player.common.id;
                player.common.isHost = true;
                console.log(`Host of Room ID ${this.common.id} set to the Player with ID ${player.common.id} with IP ${player.ip}.`);
            }
        }
    }

    /**
     * Returns the host of this Room.
     * @returns {Number|String} The Player ID who is currently the host, or the String name of the Player who created the room if they haven't connected.
     */
    getHost() {
        return this.common.host;
    }

    /**
     * Finds a new host for this Room.
     * @param {String} lastHostName The name of the last host to reset to, in case nobody else is connected.
     */
    findHost(lastHostName) {
        let player = lastHostName;
        for (let h = 0; h < this.players.length; h++) {
            if (this.players[h] !== undefined) {
                player = this.players[h];
                break;
            }
        }
        if (player === lastHostName) {
            this.common.host = player;
        } else {
            this.setHost(player);
        }
    }

    /**
     * Sends an object containing an array of all PlayerCommons in the room and all common game data, for use by the players connected.
     * @param {[String]} message An optional message to send alongside the array, to all players.
     */
    sendSelf(message = "") {
        let array = [];
        for (let p = 0; p < this.players.length; p++) {
            array.push(this.players[p].common);
        }
        
        let packet = new Packet("--update",{
            message: message,
            array: array,
            common: this.common
        });
        this.sendAll(packet);
    }

    /**
     * Sends a packet to all the players connected to this room, with the option to exclude one if needed.
     * @param {Packet} packet The packet to send.
     * @param {[WebSocket]} ws An optional WebSocket to exclude from the sending.
     */
    sendAll(packet,ws = undefined) {
        for (let p = 0; p < this.players.length; p++) {
            if (this.players[p].ws !== ws) {
                this.players[p].send(packet);
            }
        }
    }

    /**
     * Sends a ping packet to all players in this room.
     */
    pingAll() {
        let pingArray = [];
        for (let p = 0; p < this.players.length; p++) {
            pingArray.push({
                id: this.players[p].common.id,
                ping: Date.now()-this.players[p].lastPing
            });
        }
        let packet = new Packet("--ping",pingArray);
        this.sendAll(packet);
        for (let p = 0; p < this.players.length; p++) {
            this.players[p].pinged();
        }
    }

    /**
     * Invoked to set a timeout to remove an empty room.
     */
    setEmptyTimeout() {
        if (this.myTimeout !== undefined) {
            clearTimeout(this.myTimeout);
        }
        this.myTimeout = setTimeout((obj) => {
            if (obj.players.length === 0) {
                console.log(`No players are present in Room ID ${obj.common.id}. Removing...`);
                obj.manager.removeRoom(obj.common.id);
            }
        },Config.get().RoomEmptyTimeout,this);
    }

    /**
     * Returns true if all Players of this Room are connected, false if the Room is waiting for any to reconnect.
     * @returns {Boolean}
     */
    allConnected() {
        for (let p = 0; p < this.players.length; p++) {
            if (!this.players[p].common.connected) {
                return false;
            }
        }
        return true;
    }

    /**
     * When called, begins the game and launches the game logic interval.
     */
    startGame() {
        if (this.allConnected()) {
            if (!this.common.inProgress) {
                this.common.inProgress = true
                this.common.paused = false;
                if (this.logicInterval === undefined && Config.get().LogicInterval > 0) {
                    this.logicInterval = setInterval(() => { // Logic interval
                        this.emit("logic");
                        if (!this.common.paused) {
                            this.gameLogic();
                            for (let p = 0; p < this.players.length; p++) {
                                this.players[p].gameLogic();
                            }
                        }
                    },Config.get().LogicInterval);
                }
                this.sendAll(new Packet("--gamestate","start"));
                this.emit("start");
            } else {
                console.warn(`Cannot start a Room that is already in progress! ID: ${this.common.id}`);
            }
        } else {
            console.warn(`Cannot start a Room without all Players connected! ID: ${this.common.id}`);
        }
    }

    /**
     * Pauses or unpauses the game. This prevents the logic interval from firing, but maintains the session.
     */
    pauseGame() {
        if (this.allConnected()) {
            if (this.common.inProgress) {
                if (!this.common.paused) {
                    //Pause
                    this.common.paused = true;
                    this.sendAll(new Packet("--gamestate","paused"));
                    this.emit("paused");
                } else {
                    //Unpause
                    this.common.paused = false;
                    this.sendAll(new Packet("--gamestate","unpaused"));
                    this.emit("unpaused");
                }
            } else {
                console.warn(`Cannot pause a Room that is not in progress! ID: ${this.common.id}`);
            }
        } else {
            console.warn(`Cannot pause or unpause a Room without all Players connected! ID: ${this.common.id}`)
        }
    }

    /**
     * Ends a game and stops the game logic interval.
     */
    endGame() {
        if (this.allConnected()) {
            if (this.common.inProgress) {
                this.common.inProgress = false;
                this.common.paused = false;
                if (this.logicInterval !== undefined) {
                    clearInterval(this.logicInterval);
                    this.logicInterval = undefined;
                }
                this.sendAll(new Packet("--gamestate","end"));
                this.emit("end");
            } else {
                console.warn(`Cannot end a Room that is not in progress! ID: ${this.common.id}`);
            }
        } else {
            console.warn(`Cannot end a Room without all Players connected! ID: ${this.common.id}`);
        }
    }

    /**
     * Invoked over a specified interval to do game logic.
     */
    gameLogic() {
        //Does nothing by default. Must be overwritten via cn.Room.prototype.gameLogic = function() {...}
    }
}