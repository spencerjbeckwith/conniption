module.exports = class Packet {
    /**
     * Creates a new packet of data to send. Must be send through Packet.send(...)
     * @param {String} type The type of Packet to send.
     * @param {String} message The contents of the Packet to send. Can be JSON.
     */
    constructor(type,message = "") {
        this.type = type;
        this.message = message;
    }

    /**
     * Sends a packet over a WebSocket.
     * @param {WebSocket} ws The WebSocket to send this packet across.
     */
    send(ws) {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify(this));
        }
    }
}