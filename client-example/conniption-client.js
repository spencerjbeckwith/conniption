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
            PingInterval: 500
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
                //EVENT
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
                //p.textContent = "Connection closed.";
                //EVENT
                this.disconnect();
            });
    
            this.ws.addEventListener("error",(error) => {
                //p.textContent = "An error has occured. "+error;
                //EVENT
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
     * Adds all code for the default Conniption client packets.
     */
    addDefaultPackets() {
        //FETCH packet: Server sent us a list of all game rooms.
        this.addPacketType("--fetch",(message) => {
            let roomList = message;
            console.log(roomList);
            //do something with the array, HERE
        });
        
        //MAKE packet: Server approved our request to make a new game room.
        this.addPacketType("--make",(message) => {
            console.log("Our room is room ID "+message+"! Connecting...");
            this.roomID = message;
            //inputGameID.value = roomID;
            setTimeout((obj) => {
                obj.connect("join");
            },100,this);
        });
        
        //JOIN packet: Server approved our attempt to join a game room.
        this.addPacketType("--join",(message) => {
            this.id = message;
            console.log(`We joined the game! We are Player ID ${this.id} in Room ID ${this.roomID}`);
            //p.textContent = "We joined the game!";
            //EVENT
        
            //begin our pinging
            this.Game.pingInterval = setInterval(function(obj) {
                obj.Game.pinged();
            },this.Config.PingInterval,this);
        });
        
        //REFUSAL packet: We've been disconnected for some reason.
        this.addPacketType("--refusal",(message) => {
            console.error(`Connection refused: ${message}`);
            console.log(message);
            //p.textContent = message;
            //EVENT
            this.disconnect();
        });
        
        //PLAYERS packet: We've gotten an update on the game, game logic, and player connections.
        this.addPacketType("--players",(message) => {
            if (message.message !== "") {
                console.log(message.message);
            }
            //Load our game's players and roomcommon
            this.Game.players = message.array;
            this.Game.common = message.common;
            //EVENT
        });
        
        //PLAYER-CONNECTION-UPDATE packet: A player was lost or found on the server.
        this.addPacketType("--player-connection-update",(message) => {
            let player = this.Game.getPlayer(message.id);
            if (player !== undefined) {
                player.connected = message.status;
                if (message.status) {
                    console.log(`${player.name} has reconnected!`);
                    //EVENT
                } else {
                    console.log(`Waiting for ${player.name} to reconnect...`);
                    //EVENT
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
            //EVENT
        });
        
        //PONG packet: The server let us know that they are still there.
        this.addPacketType("--pong",(message) => {
            this.Game.ponged();
            //EVENT
        });
        
        //GAMESTATE packet: The game has begun, been paused/unpaused, or ended.
        this.addPacketType("--gamestate",(message) => {
            switch (message) {
                case ("start"): {
                    console.log("The game has begun!");
                    this.Game.common.inProgress = true;
                    this.Game.common.paused = false;
                    //EVENT
                    break;
                }
                case ("paused"): {
                    console.log("The game has been paused.");
                    this.Game.common.paused = true;
                    //EVENT
                    break;
                }
                case ("unpaused"): {
                    console.log("The game has been unpaused.");
                    this.Game.common.paused = false;
                    //EVENT
                    break;
                }
                case ("end"): {
                    console.log("The game has ended.");
                    this.Game.common.inProgress = false;
                    this.Game.common.paused = false;
                    //EVENT
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

buttonFetch.addEventListener("click",() => {
    cn.connect("fetch");
});
buttonMake.addEventListener("click",() => {
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

inputName.value = cn.myName;
inputGameName.value = cn.roomName;
inputGamePasscode.value = cn.roomPasscode;
