// NPM imports
const {ipcMain}  = require('electron');
const path = require("path");
const net = require("net");

// Try to load injector
try {
    var injector = require('../InjectorAddon/bin/' + process.arch + '/injector');
}
catch(e) {
    var injector = false;
    console.error("Injector not available yet in this platform");
}

const dllPath = path.resolve(__dirname, "../APEDLL/bin/APEDLL_{}.dll").replace("app.asar", "app.asar.unpacked");
const kernelExe = path.resolve(__dirname, "../APEKernel/bin/APEKernel{}.exe").replace("app.asar", "app.asar.unpacked");

let dllSocket = null;
let serverReady = false;
let currentTarget = null;

let inject = (target) => {
    currentTarget = target;
    return serverReady && injector && injector.injectDLLByPID(target.pid, dllPath, kernelExe);
}

module.exports = (rendererWindow, callback) => {
    // Create the TCP server
    var server = net.createServer((socket) => {
        if (dllSocket == null) {
            dllSocket = socket;

            var lostConn = () => {
                currentTarget.lost = true;
                rendererWindow.webContents.send('lost-target', currentTarget);
                rendererWindow = null;
            };

            socket
                .on('disconnect', lostConn)
                .on('error', lostConn);
        }
    }).on('error', (err) => {
        dllSocket = null;
    });

    // Listen on TCP
    server.listen(25100, 'localhost', () => {
        address = server.address();
        serverReady = true;
        console.log('Opened server on %j', address);

        callback && callback();
    });

    // Send-code event
    ipcMain.on('send-code', (event, arg) => {
        if (dllSocket) {
            var json = {method: 'eval_js', args: [arg]};
            dllSocket.write(JSON.stringify(json));
        }
    });

    // Inject event
    ipcMain.on('inject', (event, arg) => {
        event.returnValue = inject(arg);
    });

    return {
        injector: injector,
        inject: inject
    };
};
