class Packet {
    constructor(type,message = "") {
        this.type = type;
        this.message = message;
        
        //To identify this client.
        this.sender = name;
        this.room = roomID;
    }

    send(ws) {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify(this));
        }
    }
}

class PlayerCommon {
    constructor(obj) {
        this.id = obj.id;
        this.name = obj.name;
        this.isHost = obj.isHost;
    }
}

const Game = {
    players: [],

    addPlayer(playercommon) {
        let o = new PlayerCommon(playercommon);
        this.players.push(o);
        return o;
    },

    addFromObject() {

    },

    getPlayer() {

    },

    removePlayer(playercommon) {
        let index = this.players.indexOf(playercommon);
        if (index !== -1) {
            this.players.splice(this.players.indexOf(playercommon),1);
        }
    },

    removeAll() {
        for (let i = 0; i < this.players.length; i++) {
            this.removePlayer(this.players[i]);
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

let name = "Example";
let roomRequestName = "Example Room";
let roomRequestMaxPlayers = 4;
let roomRequestPasscode = "";
let roomID = 0;

const p = document.querySelector("p");

function connect(roomRequest) {
    let ws = new WebSocket("ws://localhost:44956");
    ws.addEventListener("open",() => {
        switch (roomRequest) {
            case ("fetch"): {
                console.log("Fetching game rooms...");
                new Packet("--fetch").send(ws);
                break;
            }
            case ("make"): {
                console.log("Requesting to make a new room...")
                let packet = new Packet("--make",{
                    name: roomRequestName,
                    maxPlayers: roomRequestMaxPlayers,
                    passcode: roomRequestPasscode
                });
                packet.send(ws);
                break;
            }
            case ("join"): {
                console.log("Requesting to join a room...");
                new Packet("--join",roomID).send(ws);
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
        roomID = "__INVALID__";
    });

    ws.addEventListener("error",(error) => {
        p.textContent = "An error has occured. "+error;
    });

    ws.addEventListener("message",(message) => {
        let rc = {};
        try {
            rc = JSON.parse(message.data);
        }
        catch (error) {
            rc.type = "__INVALID__";
        }
        try {
            if (rc.type === "__INVALID__") {
                throw `Packet could not be parsed`;
            }

            if (PacketCallbacks[rc.type]) {
                PacketCallbacks[rc.type].forEach((packetFunction) => {
                    packetFunction(ws,rc);
                });
            } else {
                throw `Received unidentifiable packet type: ${rc.type}`
            }
        }
        catch (error) {
            console.error(`Error receiving data: ${error}`);
            if (ws.readyState === 1) {
                ws.close();
            }
        }
    });
}

addPacketType("--fetch",(ws,rc) => {
    let roomList = rc.message;
    console.log(roomList);
});

addPacketType("--make",(ws,rc) => {
    console.log("Our room is room ID "+rc.message+"! Connecting...");
    roomID = rc.message;
    new Packet("--join",roomID).send(ws);
});

addPacketType("--join",(ws,rc) => {
    console.log("We joined the game!");
    p.textContent = "We joined the game!";
    document.querySelector("input").value = roomID;
});

addPacketType("--refusal",(ws,rc) => {
    console.error(`Connection refused: ${rc.message}`);
    p.textContent = rc.message;
    ws.close();
});

addPacketType("--players",(ws,rc) => {
    console.log(rc.message);
});

//client example functionality

document.querySelector("button.make").addEventListener("click",() => {
    console.log("Attempting to make a game...");
    connect("make");
});
document.querySelector("button.join").addEventListener("click",() => {
    roomID = document.querySelector("input").value;
    console.log("Joining room with ID "+roomID+"...");
    connect("join");
});
