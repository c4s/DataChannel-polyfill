// SSL Certificates
var fs = require('fs');

var options = {key:  fs.readFileSync('certs/privatekey.pem').toString(),
               cert: fs.readFileSync('certs/certificate.pem').toString(),
               ca:  [fs.readFileSync('certs/certrequest.csr').toString()]}

// DataChannel proxy server
var server = require('http').createServer().listen(8002);
//var server = require('https').createServer(options).listen(8002);
var WebSocketServer = require('ws').Server
var wss = new WebSocketServer({server: server});

//Array to store connections
wss.sockets = {}

wss.on('connection', function(socket)
{
    // Forward raw message to the other peer
    function onmessage_proxy(message)
    {
        this.peer.send(message.data)
    };

    // Handshake
    socket.onmessage = function(message)
    {
        var args = JSON.parse(message.data)

        var eventName = args[0]
        var socketId  = args[1]

        var soc = wss.sockets[socketId]

        switch(eventName)
        {
            case 'create':  // socketId is the peer ID
                if(soc)
                {
                    socket.id = id()
                    wss.sockets[socket.id] = socket

                    args[1] = socket.id
                    soc.send(JSON.stringify(args))
                }

                // Second peer was not connected
                // Send error message and close socket
                else
                {
                    socket.send(JSON.stringify(['create.error', socketId]))
                    socket.close();
                }

                break

            case 'ready':   // socketId is the UDT ID
                if(soc)
                {
                    // Link peers and update onmessage event to just forward
                    socket.peer = soc
                    soc.peer = socket

                    socket.onmessage = onmessage_proxy
                    soc.onmessage = onmessage_proxy

                    // Send 'ready' signal to the first peer and dettach it
                    soc.send('ready')

                    delete soc.id
                    delete wss.sockets[socketId]
                }

                // First peer was disconnected
                // Send error message and close socket
                else
                {
                    socket.send(JSON.stringify(['ready.error', socketId]))
                    socket.close();
                }

                break

            // Register peer signaling socket with this ID
            case 'setId':
                wss.sockets[socketId] = socket
        }
    };

    // Peer connection is closed, close the other end
    socket.onclose = function()
    {
        // Sockets were connected, just close them
        if(socket.peer != undefined)
            socket.peer.close();

        // Socket was not connected, remove it from sockets list
        else
            delete wss.sockets[socket.id]
    };
})

// generate a 4 digit hex code randomly
function S4()
{
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
}

// make a REALLY COMPLICATED AND RANDOM id, kudos to dennis
function id()
{
  return S4()+S4() +"-"+ S4() +"-"+ S4() +"-"+ S4() +"-"+ S4()+S4()+S4()
}