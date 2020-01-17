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

const Game = {
    common: {},
    players: [],
    pingInterval: undefined,
    pingTimeout: undefined,
    lastPing: 0,
    ping: 0,

    getPlayer(id) {
        for (let i = 0; i < this.players.length; i++) {
            if (this.players[i].id === id) {
                return this.players[i];
            }
        }
        return undefined;
    },

    pinged() {
        if (ws !== undefined) {
            if (this.pingTimeout === undefined) {
                this.lastPing = Date.now();
                new Packet("--ping").send();
                this.pingTimeout = setTimeout(() => {
                    console.error(`Lost connection to the server.`);
                    disconnect();
                },5000); //CONFIGURE ME LATER
            }
        }
    },

    ponged() {
        clearTimeout(this.pingTimeout);
        this.pingTimeout = undefined;
        this.ping = Date.now()-this.lastPing;
    },

    reset() {
        clearInterval(this.pingInterval);
        if (this.pingTimeout !== undefined) {
            clearTimeout(this.pingTimeout);
        }
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

let name = undefined;
let roomRequestName = undefined;
let roomRequestMaxPlayers = undefined;
let roomRequestPasscode = undefined;
let roomID = undefined;
let id = undefined;
let ws = undefined;
function initialize() {
    name = "Example";
    roomRequestName = "Example Room";
    roomRequestMaxPlayers = 4;
    roomRequestPasscode = "";

    roomID = undefined;
    id = undefined;
    ws = undefined;
    console.log("Initialized.");
}
initialize();

const p = document.querySelector("p");

function connect(roomRequest) {
    if (ws === undefined) {
        ws = new WebSocket("ws://localhost:44956");
        ws.addEventListener("open",() => {
            switch (roomRequest) {
                case ("fetch"): {
                    console.log("Fetching game rooms...");
                    new Packet("--fetch").send();
                    break;
                }
                case ("make"): {
                    console.log("Requesting to make a new room...")
                    let packet = new Packet("--make",{
                        name: roomRequestName,
                        maxPlayers: roomRequestMaxPlayers,
                        passcode: roomRequestPasscode
                        //other game configurable game properties would go here
                    });
                    packet.send();
                    break;
                }
                case ("join"): {
                    console.log("Requesting to join a room...");
                    new Packet("--join",name).send();
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
    setTimeout(() => {
        connect("join");
    },100);
});

addPacketType("--join",(message) => {
    id = message;
    console.log(`We joined the game! We are Player ID ${id} in Room ID ${roomID}`);
    p.textContent = "We joined the game!";
    document.querySelector("input").value = roomID;

    //begin our pinging
    Game.pingInterval = setInterval(() => {
        Game.pinged();
    },500); //CONFIGURE ME LATER!
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
    //load a gamecommon here
    Game.players = message.array;
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

//client example functionality

document.querySelector("button.fetch").addEventListener("click",() => {
    connect("fetch");
});
document.querySelector("button.make").addEventListener("click",() => {
    connect("make");
});
document.querySelector("button.join").addEventListener("click",() => {
    roomID = document.querySelector("input").value;
    connect("join");
});
document.querySelector("button.disconnect").addEventListener("click",() => {
    disconnect();
});