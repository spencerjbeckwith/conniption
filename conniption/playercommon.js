const EventEmitter = require("events");
module.exports = class PlayerCommon extends EventEmitter {
    constructor(name) {
        super();
        this.id = Math.floor(Math.random()*100000);
        this.name = name;
        
        this.isHost = false;
        this.connected = true;
        this.ping = 0;
    }
}
