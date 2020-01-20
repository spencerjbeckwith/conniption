class Packet {
    constructor(type,message = "") {
        this.type = type;
        this.message = message;
        
        //To identify this client.
        this.id = id;
        this.room = roomID;
    }

    send() {
        if (ws !== undefined) {
            if (ws.readyState === 1) {
                ws.send(JSON.stringify(this));
            }
        }
    }
}

class PlayerCommon {
    constructor(obj) {
        this.id = obj.id;
        this.name = obj.name;
        this.isHost = obj.isHost;
        this.connected = true;
        this.ping = obj.ping;

        //Client-side. This is not present in server-side playercommon
        this.me = false;
        if (this.id === id) {
            this.me = true;
        }
    }
}

const Config = {
    ServerTimeout: 5000,
    PingInterval: 500
}

const Game = {
    common: {},
    players: [],
    pingInterval: undefined,
    pingTimeout: undefined,
    lastPing: 0,
    ping: 0,

    /**
     * Returns a PlayerCommon instance with a specified ID.
     * @param {Number} checkID The server-generator ID of the player to check.
     */
    getPlayer(checkID = id) {
        for (let i = 0; i < this.players.length; i++) {
            if (this.players[i].id === checkID) {
                return this.players[i];
            }
        }
        return undefined;
    },

    /**
     * Invoked when a ping is sent to the server, while connected.
     */
    pinged() {
        if (ws !== undefined) {
            if (this.pingTimeout === undefined) {
                this.lastPing = Date.now();
                new Packet("--ping").send();
                this.pingTimeout = setTimeout(() => {
                    console.error(`Lost connection to the server.`);
                    disconnect();
                },Config.ServerTimeout);
            }
        }
    },

    /**
     * Invoked when a pong is received back from the server.
     */
    ponged() {
        clearTimeout(this.pingTimeout);
        this.pingTimeout = undefined;
        this.ping = Date.now()-this.lastPing;
    },

    /**
     * Resets the Game back to its default state.
     */
    reset() {
        clearInterval(this.pingInterval);
        if (this.pingTimeout !== undefined) {
            clearTimeout(this.pingTimeout);
        }

        //Remove all objects.
        this.common = {};
        this.players = [];
    }
}

let PacketCallbacks = {};
/**
 * Adds a new handling function when the server receives a packet of a certain type.
 * @param {String} name The label of received packets that should react this way.
 * @param {Function} callbackFn A callback function to invoke when this type of packet is received.
 */
function addPacketType(name,callbackFn) {
    PacketCallbacks[name] = PacketCallbacks[name] || [];
    PacketCallbacks[name].push(callbackFn);
}

function connect(request,object = {}) {
    if (ws === undefined) {
        ws = new WebSocket("ws://localhost:44956");
        ws.addEventListener("open",() => {
            switch (request) {
                case ("fetch"): {
                    new Packet("--fetch").send();
                    break;
                }
                case ("make"): {
                    new Packet("--make",object).send();
                    break;
                }
                case ("join"): {
                    new Packet("--join",object).send();
                    break;
                }
                default: {
                    console.error("No request specified! Be sure to use 'fetch' 'make' or 'join' as arguments to connect(...).");
                    break;
                }
            }
        });

        ws.addEventListener("close",() => {
            p.textContent = "Connection closed.";
            disconnect();
        });

        ws.addEventListener("error",(error) => {
            p.textContent = "An error has occured. "+error;
        });

        ws.addEventListener("message",(message) => {
            let rp = {};
            try {
                rp = JSON.parse(message.data);
            }
            catch (error) {
                rp.type = "__INVALID__";
            }
            try {
                if (rp.type === "__INVALID__") {
                    throw `Packet could not be parsed`;
                }

                if (PacketCallbacks[rp.type]) {
                    PacketCallbacks[rp.type].forEach((packetFunction) => {
                        packetFunction(rp.message);
                    });
                } else {
                    throw `Received unidentifiable packet type: ${rp.type}`
                }
            }
            catch (error) {
                console.error(`Error receiving data: ${error}`);
                disconnect();
            }
        });
    } else {
        console.warn(`Cannot connect when we are already connected!`);
    }
}

function disconnect() {
    if (ws !== undefined) {
        ws.close();
        ws = undefined;
    }
    Game.reset();
}

addPacketType("--fetch",(message) => {
    let roomList = message;
    console.log(roomList);
    //do something with the array, HERE
});

addPacketType("--make",(message) => {
    console.log("Our room is room ID "+message+"! Connecting...");
    roomID = message;
    inputGameID.value = roomID;
    setTimeout(() => {
        connect("join",{
            name: myName,
            passcode: roomPasscode
        });
    },100);
});

addPacketType("--join",(message) => {
    id = message;
    console.log(`We joined the game! We are Player ID ${id} in Room ID ${roomID}`);
    p.textContent = "We joined the game!";

    //begin our pinging
    Game.pingInterval = setInterval(() => {
        Game.pinged();
    },Config.PingInterval);
});

addPacketType("--refusal",(message) => {
    console.error(`Connection refused: ${message}`);
    console.log(message);
    p.textContent = message;
    disconnect();
});

addPacketType("--players",(message) => {
    if (message.message !== "") {
        console.log(message.message);
    }
    //Load our game's players and roomcommon
    Game.players = message.array;
    Game.common = message.common;
});

addPacketType("--player-connection-update",(message) => {
    let player = Game.getPlayer(message.id);
    if (player !== undefined) {
        player.connected = message.status;
        if (message.status) {
            console.log(`${player.name} has reconnected!`);
        } else {
            console.log(`Waiting for ${player.name} to reconnect...`);
        }
    }
});

addPacketType("--ping",(message) => {
    let pingArray = message;
    for (let p = 0; p < pingArray.length; p++) {
        Game.getPlayer(pingArray[p].id).ping = pingArray[p].ping;
    }
    new Packet("--pong").send();
});

addPacketType("--pong",(ws,message) => {
    Game.ponged();
});


//CLIENT FUNCTIONALITY BELOW

const p = document.querySelector("p.status");

const inputName = document.querySelector("input.name");
const inputGameName = document.querySelector("input.game-name");
const inputGamePasscode = document.querySelector("input.game-passcode");
const inputGameID = document.querySelector("input.game-id");

const buttonFetch = document.querySelector("button.fetch");
const buttonMake = document.querySelector("button.make");
const buttonJoin = document.querySelector("button.join");
const buttonDisconnect = document.querySelector("button.disconnect");

buttonFetch.addEventListener("click",() => {
    connect("fetch");
});
buttonMake.addEventListener("click",() => {
    roomName = inputGameName.value;
    roomPasscode = inputGamePasscode.value;
    //set other things here?
    connect("make",{
        name: roomName,
        creatorName: myName,
        passcode: roomPasscode,
        maxPlayers: roomMaxPlayers
        //other game configurable game properties would go here
    });
});
buttonJoin.addEventListener("click",() => {
    myName = inputName.value;
    roomPasscode = inputGamePasscode.value;
    roomID = inputGameID.value;
    connect("join",{
        name: myName,
        passcode: roomPasscode
    }); //Don't forget: connect("join",...) is ALSO called on the receiving on a --make packet!!
});
buttonDisconnect.addEventListener("click",() => {
    disconnect();
});

function initialize() {
    myName = "Default";
    roomName = "Game Room";
    roomPasscode = "";
    roomMaxPlayers = 4;

    roomID = undefined;
    id = undefined;
    ws = undefined;

    //Set proper content of our inputs and boxes.
    inputName.value = myName;
    inputGameName.value = roomName;
    inputGamePasscode.value = "";
    //buttonDisconnect.disabled = true;

    console.log("Initialized.");
}

initialize();
