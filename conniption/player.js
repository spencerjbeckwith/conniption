const Config = require("./config.js");
const PlayerCommon = require("./playercommon.js");
const Packet = require("./packet.js");
module.exports = class Player {
    /**
     * Creates a new instance of a Player.
     * @param {String} name The username of the Player.
     * @param {WebSocket} ws The WebSocket used to receive this player's messages.
     * @param {String} ip The IP from which this player connected.
     * @param {Number} room The room ID this player has joined.
     */
    constructor(name,ws,ip,room) {
        this.ws = ws;
        this.ip = ip;
        this.room = room;

        this.common = new PlayerCommon(name);
        this.reconnectionTimeout = undefined;
        this.pingTimeout = undefined;
        this.lastPing = 0;

        //more stuff here
        //HOW can I make it so you can add more properties to a player?
    }

    /**
     * Invoked to remove this player from memory safely upon a permanent disconnection.
     */
    remove() {
        if (this.reconnectionTimeout !== undefined) {
            clearTimeout(this.reconnectionTimeout);
            this.reconnectionTimeout = undefined;
        }
        if (this.pingTimeout != undefined) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = undefined;
        }
        this.ws.close();
    }

    /**
     * Sends a packet to this player.
     * @param {Packet} packet The packet to send.
     */
    send(packet) {
        if (this.common.connected && this.ws !== undefined) {
            packet.send(this.ws);
        }
    }

    /**
     * Kicks this player from the server. They are able to reconnect.
     */
    kick() {
        new Packet("--refusal","You have been removed from the server.").send(this.ws);
        this.room.removePlayer(this);
    }

    /**
     * Kicks this player from the server and adds their IP to the BlackList.
     */
    ban() {
        Config.addToBlackList(`${this.ip} - "${this.common.name}"`);
        this.kick();
    }

    /**
     * Invoked on a player when their connection is lost, and you want them to have the chance to reconnect.
     */
    lost() {
        this.common.connected = false;
        this.reconnectionTimeout = setTimeout((obj) => {
            obj.room.removePlayer(obj);
        },Config.get().Users.ReconnectionTimeout*1000,this);

        //send lost packet
        this.room.sendAll(new Packet("--player-connection-update",{
            id: this.common.id,
            status: false
        }),this.ws);
    }

    /**
     * Invoked on a player who lost their connection, when they reconnect.
     * @param {WebSocket} ws The new WebSocket the client has connected from.
     */
    found(ws) {
        this.common.connected = true;
        clearTimeout(this.reconnectionTimeout);
        this.reconnectionTimeout = undefined;

        this.ws = ws;

        //send found packet
        this.room.sendAll(new Packet("--player-connection-update",{
            id: this.common.id,
            status: true
        }),this.ws);
    }

    /**
     * Invoked on a player when a ping packet is sent to them.
     */
    pinged() {
        if (this.pingTimeout === undefined) {
            this.pingTimeout = setTimeout((obj) => {
                obj.room.removePlayer(obj);
            },Config.get().PingTimeout,this);
            this.lastPing = Date.now();
        }
    }

    /**
     * Invoked on a player when a pong packet is received from them.
     */
    ponged() {
        clearTimeout(this.pingTimeout);
        this.pingTimeout = undefined;
        this.common.ping = Date.now()-this.lastPing;
    }
}