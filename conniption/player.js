const Config = require("./config.js");
const PlayerCommon = require("./playercommon.js");
module.exports = class Player {
    /**
     * Creates a new instance of a Player.
     * @param {String} name The username of the Player.
     * @param {WebSocket} ws The WebSocket used to receive this player's messages.
     * @param {String} ip The IP from which this player connected.
     * @param {Number} room The room ID this player has joined.
     */
    constructor(name,ws,ip,room) {
        this.connected = true;
        this.ws = ws;
        this.ip = ip;
        this.room = room;
        this.reconnectionTimeout = undefined;

        this.common = new PlayerCommon(name);

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
        this.ws.close();
    }

    send(packet) {
        if (this.connected && this.ws !== undefined) {
            packet.send(this.ws);
        }
    }

    kick() {

    }

    ban() {

    }

    /**
     * Invoked on a player when their connection is lost, and you want them to have the chance to reconnect.
     */
    lost() {
        this.connected = false;
        this.reconnectionTimeout = setTimeout((obj) => {
            obj.room.removePlayer(obj);
        },Config.get().Users.ReconnectionTimeout*1000,this);

        //send lost packet
    }

    /**
     * Invoked on a player who lost their connection, when they reconnect.
     */
    found() {
        this.connected = true;
        clearTimeout(this.reconnectionTimeout);
        this.reconnectionTimeout = undefined;

        //send found packet
    }
}