class Conniption extends EventTarget {
    constructor() {
        super();
        this.myName = "Default";
        this.roomName = "Game Room";
        this.roomPasscode = "";
        this.roomMaxPlayers = 4;

        this.id = undefined;
        this.roomID = undefined;
        this.ws = undefined;
        this.PacketCallbacks = {};

        this.Config = {
            ip: "ws://localhost:44956",
            ServerTimeout: 5000,
            PingInterval: 500,
            JoinDelay: 100
        }

        this.Game = {
            common: {},
            players: [],
            pingInterval: undefined,
            pingTimeout: undefined,
            lastPing: 0,
            ping: 0,
        
            /**
             * Returns a client-side PlayerCommon instance with a specified ID.
             * @param {Number} checkID The server-generated ID of the player to check.
             */
            getPlayer(checkID) {
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
                if (this.ws !== undefined) {
                    if (this.pingTimeout === undefined) {
                        this.lastPing = Date.now();
                        new this.Packet(this,"--ping").send();
                        this.pingTimeout = setTimeout((obj) => {
                            console.error(`Lost connection to the server.`);
                            obj.disconnect();
                        },Config.ServerTimeout,obj);
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

        /**
         * Creates a new Packet to be sent to the server.
         * @param {Conniption} cn The Conniption instance that this packet should use for its ID, roomID, and WebSocket.
         * @param {String} type The type of the packet to send.
         * @param {String} message The content to send in the packet. Can be any type, or even an object, as long as it is received properly by the server.
         */
        this.Packet = function(cn,type,message = "") {
            this.type = type;
            this.message = message;
            
            //To identify this client.
            this.id = cn.id;
            this.room = cn.roomID;
            this.ws = cn.ws;
        }
        this.Packet.prototype = {
            constructor: this.Packet,
            send: function() {
                if (this.ws !== undefined) {
                    if (this.ws.readyState === 1) {
                        this.ws.send(JSON.stringify(this));
                    }
                }
            }
        }

        this.addDefaultPackets();
    }
    
    /**
     * Adds a new handling function when the server receives a packet of a certain type.
     * @param {String} name The label of received packets that should react this way.
     * @param {Function} callbackFn A callback function to invoke when this type of packet is received.
     */
    addPacketType(name,callbackFn) {
        this.PacketCallbacks[name] = this.PacketCallbacks[name] || [];
        this.PacketCallbacks[name].push(callbackFn);
    }

    /**
     * Attempts to connect to the server to fetch active games, make a new one, or join an existing one.
     * @param {String} request Either "fetch", "make", or "join": The action to connect to the server and attempt to execute.
     */
    connect(request) {
        if (this.ws === undefined) {
            this.ws = new WebSocket(this.Config.ip);
            this.ws.addEventListener("open",() => {
                let event = new Event("connect");
                event.ws = this.ws;
                event.request = request;
                this.dispatchEvent(event);

                switch (request) {
                    case ("fetch"): {
                        new this.Packet(this,"--fetch").send();
                        break;
                    }
                    case ("make"): {
                        new this.Packet(this,"--make",{
                            name: this.roomName,
                            creatorName: this.myName,
                            passcode: this.roomPasscode,
                            maxPlayers: this.roomMaxPlayers
                        }).send();
                        break;
                    }
                    case ("join"): {
                        new this.Packet(this,"--join",{
                            name: this.myName,
                            passcode: this.roomPasscode
                        }).send();
                        break;
                    }
                    default: {
                        console.error("No request specified! Be sure to use 'fetch' 'make' or 'join' as arguments to connect(...).");
                        this.disconnect();
                        break;
                    }
                }
            });
    
            this.ws.addEventListener("close",() => {
                let event = new Event("disconnect");
                event.ws = this.ws;
                this.dispatchEvent(event);
                this.disconnect();
            });
    
            this.ws.addEventListener("error",(error) => {
                let event = new Event("error");
                event.error = error;
                this.dispatchEvent(event);
            });
    
            this.ws.addEventListener("message",(message) => {
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
    
                    if (this.PacketCallbacks[rp.type]) {
                        this.PacketCallbacks[rp.type].forEach((packetFunction) => {
                            packetFunction(rp.message);
                        });
                    } else {
                        throw `Received unidentifiable packet type: ${rp.type}`
                    }
                }
                catch (error) {
                    console.error(`Error receiving data: ${error}`);
                    this.disconnect();
                }
            });
        } else {
            console.warn(`Cannot connect when we are already connected!`);
        }
    }

    /**
     * Disconnections this Conniption instance from anything it may be connected to.
     */
    disconnect() {
        if (this.ws !== undefined) {
            this.ws.close();
            this.ws = undefined;
        }
        this.Game.reset();
    }

    /**
     * Sends a GameState packet to request a change in the gamestate.
     */
    gameState(request) {
        new this.Packet(this,"--gamestate",request).send();;
    }

    /**
     * Adds all code for the default Conniption client packets.
     */
    addDefaultPackets() {
        //FETCH packet: Server sent us a list of all game rooms.
        this.addPacketType("--fetch",(message) => {
            let event = new Event("fetch");
            event.roomList = message;
            this.dispatchEvent(event);
        });
        
        //MAKE packet: Server approved our request to make a new game room.
        this.addPacketType("--make",(message) => {
            console.log("Our room is room ID "+message+"! Connecting...");
            this.roomID = message;
            let event = new Event("make");
            event.roomID = this.roomID;
            event.timeout = setTimeout((obj) => {
                obj.connect("join");
            },this.Config.JoinDelay,this);
            this.dispatchEvent(event);
        });
        
        //JOIN packet: Server approved our attempt to join a game room.
        this.addPacketType("--join",(message) => {
            this.id = message;
            console.log(`We joined the game! We are Player ID ${this.id} in Room ID ${this.roomID}`);
            let event = new Event("join");
            event.id = this.id;
            event.roomID = this.roomID;
            this.dispatchEvent(event);
        
            //begin our pinging
            this.Game.pingInterval = setInterval(function(obj) {
                obj.Game.pinged();
            },this.Config.PingInterval,this);
        });
        
        //REFUSAL packet: We've been disconnected for some reason.
        this.addPacketType("--refusal",(message) => {
            console.error(`Connection refused: ${message}`);
            console.log(message);
            
            let event = new Event("refused");
            event.message = message;
            this.dispatchEvent(event);

            this.disconnect();
        });
        
        //UPDATE packet: We've gotten an update on the game, game logic, and player connections.
        this.addPacketType("--update",(message) => {
            if (message.message !== "") {
                console.log(message.message);
            }
            //Load our game's players and roomcommon
            this.Game.players = message.array;
            this.Game.common = message.common;

            let event = new Event("update");
            event.message = message.message;
            event.array = message.array;
            event.common = message.common;
            this.dispatchEvent(event);
        });
        
        //PLAYER-CONNECTION-UPDATE packet: A player was lost or found on the server.
        this.addPacketType("--player-connection-update",(message) => {
            let player = this.Game.getPlayer(message.id);
            if (player !== undefined) {
                player.connected = message.status;
                if (message.status) {
                    console.log(`${player.name} has reconnected!`);
                    let event = new Event("reconnect");
                    event.player = player;
                    this.dispatchEvent(event);
                } else {
                    console.log(`Waiting for ${player.name} to reconnect...`);
                    let event = new Event("lost");
                    event.player = player;
                    this.dispatchEvent(event);
                }
            }
        });
        
        //PING packet: The server is making sure we're still here.
        this.addPacketType("--ping",(message) => {
            let pingArray = message;
            for (let p = 0; p < pingArray.length; p++) {
                this.Game.getPlayer(pingArray[p].id).ping = pingArray[p].ping;
            }
            new this.Packet(this,"--pong").send();
            let event = new Event("ping");
            event.pingArray = pingArray;
            this.dispatchEvent(event);
        });
        
        //PONG packet: The server let us know that they are still there.
        this.addPacketType("--pong",(message) => {
            this.Game.ponged();
            let event = new Event("pong");
            this.dispatchEvent(event);
        });
        
        //GAMESTATE packet: The game has begun, been paused/unpaused, or ended.
        this.addPacketType("--gamestate",(message) => {
            switch (message) {
                case ("start"): {
                    console.log("The game has begun!");
                    this.Game.common.inProgress = true;
                    this.Game.common.paused = false;
                    let event = new Event("start");
                    this.dispatchEvent(event);
                    break;
                }
                case ("paused"): {
                    console.log("The game has been paused.");
                    this.Game.common.paused = true;
                    let event = new Event("pause");
                    this.dispatchEvent(event);
                    break;
                }
                case ("unpaused"): {
                    console.log("The game has been unpaused.");
                    this.Game.common.paused = false;
                    let event = new Event("unpause");
                    this.dispatchEvent(event);
                    break;
                }
                case ("end"): {
                    console.log("The game has ended.");
                    this.Game.common.inProgress = false;
                    this.Game.common.paused = false;
                    let event = new Event("end");
                    this.dispatchEvent(event);
                    break;
                }
                default: {
                    throw `Received invalid gamestate packet with message: ${message}.`;
                }
            }
        });
    }
}

//CLIENT FUNCTIONALITY BELOW. EVERYTHING ABOVE THIS LINE CAN BE CUT AND PASTED AND STILL WORK.

const cn = new Conniption();

const p = document.querySelector("p.status");

const inputName = document.querySelector("input.name");
const inputGameName = document.querySelector("input.game-name");
const inputGamePasscode = document.querySelector("input.game-passcode");
const inputGameID = document.querySelector("input.game-id");

const buttonFetch = document.querySelector("button.fetch");
const buttonMake = document.querySelector("button.make");
const buttonJoin = document.querySelector("button.join");
const buttonDisconnect = document.querySelector("button.disconnect");

const buttonStart = document.querySelector("button.start");
const buttonPause = document.querySelector("button.pause");
const buttonEnd = document.querySelector("button.end");

buttonFetch.addEventListener("click",() => {
    cn.connect("fetch");
});
buttonMake.addEventListener("click",() => {
    cn.myName = inputName.value;
    cn.roomName = inputGameName.value;
    cn.roomPasscode = inputGamePasscode.value;
    cn.connect("make");
});
buttonJoin.addEventListener("click",() => {
    cn.myName = inputName.value;
    cn.roomPasscode = inputGamePasscode.value;
    cn.roomID = inputGameID.value;
    cn.connect("join");
});
buttonDisconnect.addEventListener("click",() => {
    cn.disconnect();
});

buttonStart.addEventListener("click",() => {
    cn.gameState("start");
});
buttonPause.addEventListener("click",() => {
    cn.gameState("pause");
});
buttonEnd.addEventListener("click",() => {
    cn.gameState("end");
});

inputName.value = cn.myName;
inputGameName.value = cn.roomName;
inputGamePasscode.value = cn.roomPasscode;

cn.addEventListener("disconnect",(event) => {
    console.log(`Connection closed.`);
});

cn.addEventListener("error",(event) => {
    console.error(event.error);
});

cn.addEventListener("fetch",(event) => {
    console.log(event.roomList);
});

cn.addEventListener("make",(event) => {
    inputGameID.value = event.roomID;
});

cn.addEventListener("join",(event) => {
    p.textContent = "We have joined the game!";
});

cn.addEventListener("refused",(event) => {
    p.textContent = event.message;
});

cn.addEventListener("update",(event) => {
    if (event.message !== "") {
        p.textContent = event.message;
    }
});