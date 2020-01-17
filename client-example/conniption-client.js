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
        this.connected = true;
    }
}

const Game = {
    common: {},
    players: [],

    getPlayer(id) {
        for (let i = 0; i < this.players.length; i++) {
            if (this.players[i].id === id) {
                return this.players[i];
            }
        }
        return undefined;
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
                    packetFunction(ws,rp.message);
                });
            } else {
                throw `Received unidentifiable packet type: ${rp.type}`
            }
        }
        catch (error) {
            console.error(`Error receiving data: ${error}`);
            if (ws.readyState === 1) {
                ws.close();
            }
        }
    });

    return ws;
}

addPacketType("--fetch",(ws,message) => {
    let roomList = message;
    console.log(roomList);
});

addPacketType("--make",(ws,message) => {
    console.log("Our room is room ID "+message+"! Connecting...");
    roomID = message;
    new Packet("--join",roomID).send(ws);
});

addPacketType("--join",(ws,message) => {
    console.log("We joined the game!");
    p.textContent = "We joined the game!";
    document.querySelector("input").value = roomID;
});

addPacketType("--refusal",(ws,message) => {
    console.error(`Connection refused: ${message}`);
    p.textContent = message;
    ws.close();
});

addPacketType("--players",(ws,message) => {
    if (message.message !== "") {
        console.log(message.message);
    }
    //load a gamecommon here
    Game.players = message.array;
});

addPacketType("--player-connection-update",(ws,message) => {
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
    //send a quit packet
});