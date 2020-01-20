const EventEmitter = require("events");
module.exports = class RoomCommon extends EventEmitter {
    constructor(name,creatorName) {
        super();
        this.id = Math.floor(Math.random()*1000000000);
        this.name = name;

        this.inProgress = false;
        this.paused = false;
        this.host = creatorName;
    }
}
