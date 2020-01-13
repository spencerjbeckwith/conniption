const PlayerCommon = require("./playercommon.js");

module.exports = class Player {
    /**
     * 
     * @param {String} name The username of the Player.
     * @param {*} ws The WebSocket used to receive this player's messages.
     * @param {*} ip The IP from which this player connected.
     * @param {*} room The room this player has joined.
     */
    constructor(name,ws,ip,room) {
        this.connected = true;
        this.ws = ws;
        this.ip = ip;
        this.room = room;

        this.common = new PlayerCommon(name);

        //more stuff here
        //HOW can I make it so you can add more properties to a player?
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
}