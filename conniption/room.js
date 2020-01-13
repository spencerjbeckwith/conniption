module.exports = class Room {
    constructor(name,maxPlayers,passcode = "") {
        this.id = Math.floor(Math.random()*1000000000);
        this.name = name;
        this.passcode = passcode;
        this.maxPlayers = maxPlayers;

        this.players = [];
        this.inProgress = false;
        this.manager = undefined;

        console.log(`New room ${this.name} created with ID ${this.id}.`)
    }

    remove() {
        //Handle the room stuff here
        console.log(`Removed room ${this.name} with ID ${this.id}`);
    }

    addPlayer() {

    }

    getPlayer() {

    }

    removePlayer() {

    }

    sendAll() {

    }

    pingAll() {

    }

    broadcast() {

    }

    getSendable() {

    }
}