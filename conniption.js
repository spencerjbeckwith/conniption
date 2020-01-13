const WebSocket = require("ws");

let PacketCallbacks = {};

const Config = require("./conniption/config.js");
const Utility = require("./conniption/utility.js");
const Packet = require("./conniption/packet.js");
const Room = require("./conniption/room.js");
const PlayerCommon = require("./conniption/playercommon.js");
const Player = require("./conniption/player.js");

const RoomManager = {
    list: [],

    /**
     * Creates a new Room.
     * @param {String} name The name used to identify the Room by.
     * @param {String} creatorName The name used by the Player who requested the room. Will be the first host when they connect.
     * @param {[Number]} maxPlayers Maximum number of players who can connect to the room.
     * @param {[String]} passcode An optional passcode needed to connect to the room.
     * @returns {Number} The ID of the new room.
     */
    addRoom(name,creatorName,maxPlayers = Config.get().DefaultPlayersPerRoom,passcode = "") {
        if (name === "") {
            throw `Room name must not be empty!`;
        }
        let room = new Room(name,creatorName,maxPlayers,passcode);
        this.list.push(room);
        room.manager = this;
        return room.id;
    },

    /**
     * Returns a specific Room instance.
     * @param {Number|String} arg Either the name or the ID of the Room you want to find.
     * @returns {Room} The Room instance associated with the name and ID.
     */
    getRoom(arg) {
        for (let i = 0; i < this.list.length; i++) {
            if (this.list[i].id === arg || this.list[i].name === arg) {
                return this.list[i];
            }
        }
        throw `No Room exists with name or ID "${arg}"!`;
    },

    /**
     * Removes a specific Room instance from the server.
     * @param {Number|String} arg Either the name or the ID of the Room you want to find.
     * @returns {Boolean} If the room was removed successfully or not.
     */
    removeRoom(arg) {
        let room = this.getRoom(arg);
        if (room !== undefined) {
            room.remove();
            this.list.splice(this.list.indexOf(room),1);
            return true;
        }
        return false;
    },

    /**
     * Removes all Room instances from the server.
     */
    removeAll() {
        for (let i = 0; i < this.list.length; i++) {
            this.removeRoom(this.list[i].id);
        }
    },

    /**
     * Returns an array of all Rooms currently present on the server, to be sent on a fetch packet.
     * @returns {String} A stringified JSON array holding objects of each current Room.
     */
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
    console.log(`Opening server on port ${Config.get().Port}...`);

    const wss = new WebSocket.Server({
        port: Config.get().Port
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
            },Config.get().RoomRequestTimeout,ws);
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
                new Packet("refusal",error).send(ws);
                ws.close();
            }
        });

        ws.on("close",() => {
            //Disconnect/remove client
        });
    });
}

//Fetch packet: return our list of Rooms.
addPacketType("fetch",(ws) => {
    clearTimeout(ws.roomRequestTimeout);
    new Packet("fetch",RoomManager.getSendable()).send(ws);
    ws.close();
});

//Make packet: Make a new room, send it back to the requester to connect.
addPacketType("make",(ws,receivedPacket) => {
    clearTimeout(ws.roomRequestTimeout);
    let obj;
    try {
        obj = JSON.parse(receivedPacket.message)
    }
    catch {
        throw `Could not parse the make request.`;
    }
    let newID = RoomManager.addRoom(obj.name,receivedPacket.sender,obj.maxPlayers,obj.passcode);
    new Packet("make",newID).send(ws);
});

//Join packet: Try to add the requester to their specified Room.
addPacketType("join",(ws,receivedPacket) => {
    clearTimeout(ws.roomRequestTimeout);
    let id = receivedPacket.room;
    try {
        let room = RoomManager.getRoom(id);
        room.addPlayer(receivedPacket.sender,ws,ws._socket.remoteAddress);
        new Packet("join").send(ws);
        //Let other clients know about each other, HERE
    }
    catch (error) {
        throw `Player could not join Room with ID "${id}": ${error}`;
    }
});

//Put default packet types here.

/**
 * Invoke to launch the Conniption server.
 * @param {[String]} file The optional configuration file to use.
 */
function launch(file = "config/config.json") {
    Config.load(file,launchServer);
}

module.exports = {
    Config: Config,
    Utility: Utility,
    Packet: Packet,
    Room: Room,
    PlayerCommon: PlayerCommon,
    Player: Player,
    RoomManager: RoomManager,
    addPacketType: addPacketType,
    launch: launch
}
