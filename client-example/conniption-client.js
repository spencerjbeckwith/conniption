class Packet {
    constructor(type,message = "") {
        this.sender = name;
        this.type = type;
        this.message = message;
    }

    send() {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify(this));
        }
    }
}

let name = "Example";
let ws = new WebSocket("ws://localhost:44956");
const p = document.querySelector("p");

ws.addEventListener("open",() => {
    p.textContent = "Connection successful!";
});

ws.addEventListener("close",() => {
    p.textContent = "Connection closed.";
});

ws.addEventListener("error",(error) => {
    p.textContent = "An error has occured. "+error;
});

ws.addEventListener("message",() => {
    p.textContent = "Data has been received.";
});