const WebSocket = require("ws");

let PacketCallbacks = {};

const Config = require("./conniption/config.js");
const Utility = require("./conniption/utility.js");
const Packet = require("./conniption/packet.js");
const Room = require("./conniption/room.js");
const RoomCommon = require("./conniption/roomcommon.js");
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
     * @returns {Number|undefined} The ID of the new room, or undefined if it fails.
     */
    addRoom(name,creatorName,passcode = "",maxPlayers = Config.get().DefaultPlayersPerRoom) {
        if (name === "") {
            console.warn(`Room name must not be empty!`);
            return undefined;
        }
        let room = new Room(name,creatorName,maxPlayers,passcode);
        this.list.push(room);
        room.manager = this;
        return room.common.id;
    },

    /**
     * Returns a specific Room instance.
     * @param {Number} roomID The ID of the Room you want to find.
     * @returns {Room|undefined} The Room instance associated with the ID, or undefined if the room couldn't be found.
     */
    getRoom(roomID) {
        for (let i = 0; i < this.list.length; i++) {
            if (this.list[i].common.id == roomID) {
                return this.list[i];
            }
        }
        console.warn(`No Room exists with ID "${roomID}"!`);
        return undefined;
    },

    /**
     * Removes a specific Room instance from the server.
     * @param {Number} roomID Either the ID of the Room you want to find.
     * @returns {Boolean} If the room was removed successfully or not.
     */
    removeRoom(roomID) {
        let room = this.getRoom(roomID);
        if (room !== undefined) {
            room.remove();
            this.list.splice(this.list.indexOf(room),1);
            return true;
        }
        return false;
    },

    /**
     * Sends a ping packet to every player of every room.
     * Must be used with "RoomManager" because this is called on an interval when the server opens.
     */
    pingAll() {
        for (let i = 0; i < RoomManager.list.length; i++) {
            RoomManager.list[i].pingAll();
        }
    },

    /**
     * Returns an array of all Rooms currently present on the server, to be sent on a fetch packet.
     * @returns {Array} An array holding objects of each current Room.
     */
    getSendable() {
        let returnObject = [];
        for (let i = 0; i < this.list.length; i++) {
            returnObject[i] = {
                id: this.list[i].common.id,
                name: this.list[i].common.name,
                passcode: (this.list[i].passcode !== ""),
                maxPlayers: this.list[i].maxPlayers,
                players: this.list[i].players.length,
                inProgress: this.list[i].common.inProgress
            }
        }
        return returnObject;
    },

    /**
     * Removes all rooms and all players connected to them. Safely ends and disconnects everything.
     */
    removeAll() {
        for (let i = 0; i < this.list.length; i++) {
            this.removeRoom(this.list[i].common.id);
        }
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
 * Internal function that opens the server. This is not exposed through NPM because it is called by cn.launch()
 */
function launchServer() {
    console.log(`Opening server on port ${Config.get().Port}...`);

    const wss = new WebSocket.Server({
        port: Config.get().Port
    });

    wss.on("listening",() => {
        console.log("Server opened successfully.");
        if (Config.get().PingInterval > 0) {
            setInterval(RoomManager.pingAll,Config.get().PingInterval);
        }
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
            let rp = {};
            try {
                rp = JSON.parse(data);
            }
            catch (error) {
                rp.type = "__INVALID__";
            }
            try {
                if (rp.type === "__INVALID__") {
                    throw `Packet could not be parsed`;
                }

                //Call correct packet function(s) for the type
                if (PacketCallbacks[rp.type]) {
                    PacketCallbacks[rp.type].forEach((packetFunction) => {
                        packetFunction(ws,rp);
                    });
                } else {
                    throw `Received unidentifiable packet type: ${rp.type}`
                }
            }
            catch (error) {
                console.error(`Error receiving data: ${error}`);
                console.error(error);
                new Packet("--refusal",error).send(ws);
                ws.close();
            }
        });

        ws.on("close",() => {
            //Disconnect/remove client
            if (ws.myRoom !== undefined) {
                let obj = ws.myRoom.getPlayer(ws);
                if (obj !== undefined) {
                    obj.room.lostPlayer(obj);
                }
            }
        });
    });
}

//Fetch packet: return our list of Rooms.
addPacketType("--fetch",(ws) => {
    clearTimeout(ws.roomRequestTimeout);
    if (!Config.checkAllowed(ws._socket.remoteAddress)) {
        throw `You are not allowed to connect to this server.`;
    }
    new Packet("--fetch",RoomManager.getSendable()).send(ws);
    new Packet("--refusal",`Fetching complete.`).send(ws);
    ws.close();
});

//Make packet: Make a new room, send it back to the requester to connect.
addPacketType("--make",(ws,rp) => {
    clearTimeout(ws.roomRequestTimeout);
    if (!Config.checkAllowed(ws._socket.remoteAddress)) {
        throw `You are not allowed to connect to this server.`;
    }
    let newID = RoomManager.addRoom(rp.message.name,rp.message.creatorName,rp.message.passcode,rp.id,rp.message.maxPlayers);
    new Packet("--make",newID).send(ws);
    new Packet("--refusal",`Making complete.`).send(ws);
    ws.close();
});

//Join packet: Try to add the requester to their specified Room.
addPacketType("--join",(ws,rp) => {
    clearTimeout(ws.roomRequestTimeout);
    if (!Config.checkAllowed(ws._socket.remoteAddress)) {
        throw `You are not allowed to connect to this server.`;
    }
    let roomID = rp.room;
    try {
        let room = RoomManager.getRoom(roomID);
        if (room === undefined) {
            throw `That room does not exist!`;
        }
        
        let player = room.addPlayer(rp.message.name,rp.message.passcode,ws,ws._socket.remoteAddress);
        new Packet("--join",player.common.id).send(ws);
    }
    catch (error) {
        throw `Player could not join Room with ID ${roomID}: ${error}`;
    }
});

//Ping packet: ping to all players of all rooms.
addPacketType("--ping",(ws,rp) => {
    new Packet("--pong").send(ws);
});

//Pong packet: reset the timeout of whoever had sent it.
addPacketType("--pong",(ws,rp) => {
    RoomManager.getRoom(rp.room).getPlayer(rp.id).ponged();
});

//gamestate packet: A client's request to change their game's state.
addPacketType("--gamestate",(ws,rp) => {
    let myRoom = packetRoom(rp);
    let myPlayer = packetPlayer(rp);
    if (!Config.get().GameStateRestricted || myRoom.common.host === myPlayer.common.id) {
        switch (rp.message) {
            case ("start"): {
                myRoom.startGame();
                break;
            }
            case ("pause"): {
                myRoom.pauseGame();
                break;
            }
            case ("end"): {
                myRoom.endGame();
                break;
            }
            default: {
                throw `Invalid gamestate packet request: ${rp.message}`;
            }
        }
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

/**
 * Sets the Room prototype's eventFunction.
 * @param {Function} callbackFn Function to call on every Room instance when it is created.
 */
function setRoomEventFunction(callbackFn) {
    Room.prototype.eventFunction = callbackFn;
}

/**
 * Sets the Room prototype's gameLogic method.
 * @param {Function} callbackFn Function to use as every Room instance's gameLogic method.
 */
function setRoomLogicFunction(callbackFn) {
    Room.prototype.gameLogic = callbackFn;
}

/**
 * Sets the Player prototype's eventFunction.
 * @param {Function} callbackFn Function to call on every Player instance when it is created.
 */
function setPlayerEventFunction(callbackFn) {
    Player.prototype.eventFunction = callbackFn;
}

/**
 * Sets the Player prototype's gameLogic method.
 * @param {Function} callbackFn Function to use as every Player instance's gameLogic method.
 */
function setPlayerLogicFunction(callbackFn) {
    Player.prototype.gameLogic = callbackFn;
}

/**
 * Returns the Room instance of which the client that sent the specified Packet belongs to.
 * @param {Packet} rp The Packet received.
 * @returns {Room} The Room instance.
 */
function packetRoom(rp) {
    return RoomManager.getRoom(rp.room);
}

/**
 * Returns the Player instance of the client that sent the specified Packet.
 * @param {Packet} rp The Packet received.
 * @returns {Player} The Player instance.
 */
function packetPlayer(rp) {
    let rm = packetRoom(rp);
    if (rm !== undefined) {
        return packetRoom(rp).getPlayer(rp.id);
    }
    return undefined;
}

module.exports = {
    //Classes/Objects
    WebSocket: WebSocket,
    Config: Config,
    Utility: Utility,
    Packet: Packet,
    Room: Room,
    RoomCommon: RoomCommon,
    Player: Player,
    PlayerCommon: PlayerCommon,
    RoomManager: RoomManager,

    //Functions
    launch: launch,
    addPacketType: addPacketType,
    setRoomEventFunction: setRoomEventFunction,
    setRoomLogicFunction: setRoomLogicFunction,
    setPlayerEventFunction: setPlayerEventFunction,
    setPlayerLogicFunction: setPlayerLogicFunction,
    packetRoom: packetRoom,
    packetPlayer: packetPlayer
}
