module.exports = class PlayerCommon {
    constructor(name) {
        this.id = Math.floor(Math.random()*100000000);
        this.name = name;
        this.isHost = false;
        this.connected = true;
    }
}
