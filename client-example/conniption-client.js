class Packet {
    constructor(type,message = "") {
        this.sender = name;
        this.type = type;
        this.message = message;
        this.room = roomID;
    }

    send(ws) {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify(this));
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
                new Packet("fetch").send(ws);
                break;
            }
            case ("make"): {
                console.log("Requesting to make a new room...")
                new Packet("make",JSON.stringify({
                    name: roomRequestName,
                    maxPlayers: roomRequestMaxPlayers,
                    passcode: roomRequestPasscode
                })).send(ws);
                break;
            }
            case ("join"): {
                console.log("Requesting to join a room...");
                new Packet("join",roomID).send(ws);
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
    });

    ws.addEventListener("error",(error) => {
        p.textContent = "An error has occured. "+error;
    });

    ws.addEventListener("message",(message) => {
        let receivedPacket = {};
        try {
            receivedPacket = JSON.parse(message.data);
        }
        catch (error) {
            receivedPacket.type = "__INVALID__";
        }
        try {
            if (receivedPacket.type === "__INVALID__") {
                throw `Packet could not be parsed`;
            }

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
            if (ws.readyState === 1) {
                ws.close();
            }
        }
    });
}

addPacketType("fetch",(ws,receivedPacket) => {
    let roomList = [];
    try {
        roomList = JSON.parse(receivedPacket.message);
    }
    catch (error) {
        throw `Unable to parse room list.`;
    }
    console.log(roomList);
});

addPacketType("make",(ws,receivedPacket) => {
    console.log("Our room is room ID "+receivedPacket.message+"! Connecting...");
    roomID = receivedPacket.message;
    new Packet("join",roomID).send(ws);
});

addPacketType("join",(ws,receivedPacket) => {
    console.log("We joined the game!");
    p.textContent = "We joined the game!";
});

addPacketType("refusal",(ws,receivedPacket) => {
    console.error(`Connection refused: ${receivedPacket.message}`);
    p.textContent = receivedPacket.message;
    ws.close();
});