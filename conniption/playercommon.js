module.exports = class PlayerCommon {
    constructor(name) {
        this.name = name;
    }

    getSendable() {
        return JSON.stringify(this);
    }
}
