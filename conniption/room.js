const Config = require("./config.js");
const Utility = require("./utility.js");
const Player = require("./player.js");
module.exports = class Room {
    constructor(name,creatorName,maxPlayers,passcode = "") {
        this.id = Math.floor(Math.random()*1000000000);
        this.name = name;
        this.passcode = passcode;
        this.maxPlayers = Math.min(maxPlayers,Config.get().MaxPlayersPerRoom);

        this.players = [];
        this.inProgress = false;
        this.manager = undefined;
        this.host = creatorName;

        console.log(`New room "${this.name}" created with ID ${this.id}. Waiting for players...`)
        this.setEmptyTimeout();
    }

    remove() {
        //Handle the room removal stuff here
        console.log(`Removed room "${this.name}" with ID ${this.id}.`);
    }

    /**
     * Invoked when a new player attempts to connect to this Room.
     * @param {String} name The name of the user who is trying to connect.
     * @param {WebSocket} ws The WebSocket of the person connecting.
     * @param {String} ip The IP the connection is coming from.
     */
    addPlayer(name,ws,ip) {
        if (!Utility.nameIsValid(name)) {
            throw `Name invalid! Must be ${Config.get().Users.Name.MinLength} to ${Config.get().Users.Name.MaxLength} characters long and must not contain any special characters.`;
        }

        //See if we're a lost player, HERE

        if (!Config.get().AllowJoinInProgress && this.inProgress) {
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

        //check blacklist and whitelist here!!!

        if (this.getPlayer(ws) !== undefined) {
            throw `WebSocket already taken!`;
        }

        let player = new Player(name,ws,ip,this);
        this.players.push(player);
        console.log(`Player "${name}" with IP ${ip} has joined Room "${this.name}" with ID ${this.id}.`);
        if (this.host === name) { //Our host connected!
            this.setHost(player);
        }
    }

    /**
     * Returns a Player instance with the specified argument, if it is connected to this Room.
     * @param {String|WebSocket} arg Either the name or WebSocket of the Player you are trying to find.
     * @returns {Player} Returns the Player instance, or undefined if none is found.
     */
    getPlayer(arg) {
        let check;
        for (let p = 0; p < this.players[p]; p++) {
            if (typeof arg === "string") {
                check = this.players[p].common.name;
            } else {
                check = this.players[p].ws;
            }
            if (check === arg) {
                return this.players[p];
            }
        }
        return undefined;
    }

    removePlayer() {

        //Remove player here

        if (this.players.length === 0) {
            this.setEmptyTimeout();
        }
    }

    /**
     * Sets a new host for this Room.
     * @param {Player} player The Player instance to make the host.
     */
    setHost(player) {
        this.host = player;
        console.log(`Host of Room "${this.name}" with ID ${this.id} set to the Player "${this.host.common.name}" with IP ${this.host.ip}.`);
    }

    /**
     * Returns the host of this Room.
     * @returns {Player|String} The Player who is currently the host, or the String name of the Player who created the room if they haven't connected.
     */
    getHost() {
        return this.host;
    }

    sendAll() {

    }

    pingAll() {

    }

    broadcast() {

    }

    getSendable() {

    }

    /**
     * Sets a timeout to remove an empty room.
     */
    setEmptyTimeout() {
        this.myTimeout = setTimeout((obj) => {
            if (obj.players.length === 0) {
                console.log(`No players are present in room "${obj.name}" with ID ${obj.id}. Removing...`);
                obj.manager.removeRoom(obj.id);
            }
        },Config.get().RoomEmptyTimeout,this);
    }
}