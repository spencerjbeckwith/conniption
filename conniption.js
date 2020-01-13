const fs = require("fs");
const WebSocket = require("ws");

let Config = {};
let PacketCallbacks = {};

const Packet = require("./conniption/packet.js");
const Room = require("./conniption/room.js");
const PlayerCommon = require("./conniption/playercommon.js");
const Player = require("./conniption/player.js");

const RoomManager = {
    list: [],

    addRoom(name,maxPlayers = getConfig("DefaultPlayersPerRoom"),passcode = "") {
        let room = new Room(name,Math.min(maxPlayers,getConfig("MaxPlayersPerRoom")),passcode);
        this.list.push(room);
        room.manager = this;
        return room.id;
    },

    getRoom(arg) {
        for (let i = 0; i < this.list.length; i++) {
            if (this.list[i].id === arg || this.list[i].name === arg) {
                return this.list[i];
            }
        }
        return undefined;
    },

    removeRoom(arg) {
        let room = this.getRoom(arg);
        if (room !== undefined) {
            room.remove();
            this.list.splice(this.list.indexOf(room),1);
            return true;
        }
        return false;
    },

    getSendable() {
        let returnObject = [];
        for (let i = 0; i < this.list.length; i++) {
            returnObject[i] = {
                id: this.list[i].id,
                name: this.list[i].name,
                passcode: (this.list[i].passcode !== ""),
                maxPlayers: this.list[i].maxPlayers,
                players: this.list[i].players.length,
                inProgress: this.list[i].inProgress
            }
        }
        return JSON.stringify(returnObject);
    }
}

/**
 * Loads configuration from a file.
 * @param {[String]} file The path to the file to load. Must be in JSON format.
 * @param {[Function]} callbackFn A callback function to invoke after the config has been loaded.
 */
function loadConfig(file = "config/config.json",callbackFn = function(){}) {
    console.log(`Loading configuration from ${file}...`);
    fs.readFile(file,"utf8",(error,data) => {
        try {
            if (error) {
                throw error;
            }
            try {
                Config = JSON.parse(data);
                console.log("Config loaded successfully.");
                callbackFn();
            }
            catch (jsonError) {
                throw `Error reading JSON from ${file}: ${jsonError}`;
            }
        }
        catch (error) {
            console.error(`Could not load configuration: ${error}`);
        }
    });
}

/**
 * Returns a value from the configuration file.
 * @param {String} name The name of the value to read from the loaded configuration.
 */
function getConfig(name) {
    return Config[name];
}

/**
 * Adds a new handling function when the server receives a packet of a certain type.
 * @param {String} name The label of received packets that should react this way.
 * @param {Function} callbackFn A callback function to invoke when this type of packet is received.
 */
function addPacketType(name,callbackFn) {
    PacketCallbacks[name] = PacketCallbacks[name] || [];
    PacketCallbacks[name].push(callbackFn);
}

/**
 * Internal function that opens the server.
 */
function launchServer() {
    console.log(`Opening server on port ${Config.Port}...`);

    const wss = new WebSocket.Server({
        port: getConfig("Port")
    });

    wss.on("listening",() => {
        console.log("Server opened successfully.");
    });

    wss.on("error",(error) => {
        console.error(`A server error has occured: ${error}`);
    });

    wss.on("connection",(ws) => {
        if (ws.roomRequestTimeout === undefined) {
            ws.roomRequestTimeout = setTimeout((ws) => {
                ws.close();
            },getConfig("RoomRequestTimeout"),ws);
        }

        ws.on("message",(data) => {
            let receivedPacket = {};
            try {
                receivedPacket = JSON.parse(data);
            }
            catch (error) {
                receivedPacket.type = "__INVALID__";
            }
            try {
                if (receivedPacket.type === "__INVALID__") {
                    throw `Packet could not be parsed`;
                }

                //Do other checks on the packet data here. Like: sender etc.

                //Call correct packet function(s) for the type
                if (PacketCallbacks[receivedPacket.type]) {
                    PacketCallbacks[receivedPacket.type].forEach((packetFunction) => {
                        packetFunction(ws,receivedPacket);
                    });
                } else {
                    throw `Received unidentifiable packet type: ${receivedPacket.type}`
                }
            }
            catch (error) {
                console.error(`Error receiving data: ${error}`);
                if (error.fileName !== undefined && error.lineNumber !== undefined) { //Does this check actually do anything?
                    console.log(`Error occured at: ${error.fileName} >> ${error.lineNumber}`);
                }

                //Send error to the client?
            }
        });

        ws.on("close",() => {
            //Disconnect/remove client
        });
    });
}

addPacketType("fetch",(ws) => {
    clearTimeout(ws.roomRequestTimeout);
    new Packet("fetch",RoomManager.getSendable()).send(ws);
    ws.close();
});

addPacketType("make",(ws,receivedPacket) => {
    clearTimeout(ws.roomRequestTimeout);
    let obj;
    try {
        obj = JSON.parse(receivedPacket.message)
    }
    catch {
        throw `Could not parse make request.`;
    }
    let newID = RoomManager.addRoom(obj.name,obj.maxPlayers,obj.passcode);
    new Packet("make",newID).send(ws);
    ws.close();
});

addPacketType("join",(ws,receivedPacket) => {
    clearTimeout(ws.roomRequestTimeout);

});

//Put default packet types here.

/**
 * Invoke to launch the Conniption server.
 * @param {[String]} file The optional configuration file to use.
 */
function launch(file = "config/config.json") {
    loadConfig(file,launchServer);
}

module.exports = {
    Packet: Packet,
    Room: Room,
    PlayerCommon: PlayerCommon,
    Player: Player,
    RoomManager: RoomManager,
    loadConfig: loadConfig,
    getConfig: getConfig,
    addPacketType: addPacketType,
    launch: launch
}
