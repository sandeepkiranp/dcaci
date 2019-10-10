// Import net module.
var net = require('net');
var fs = require('fs');
var path = require("path");
exit_condition = 0

const store_side_key = (key,id) => {
    fs.writeFile(id + ".key", key, function(err) {
    if(err) {
        return 0;
    }
    });
    console.log( id + ".key was saved!");
    return 1;
}


async function store_cap_token(data)
{
    string_data = JSON.stringify(data, null, 4)
    fs.writeFile(data["id"] + ".token", string_data, function(err) {
    if(err) {
        return 0;
    }
    });
    console.log("The file " +  data["id"] + ".token " + " was saved!");
    return 1;
}

// This function create and return a net.Socket object to represent TCP client.
function getConn(connName){

    var option = {
        host:'localhost',
        //port: 9999
        port: port
    }

    // Create TCP client.
    var client = net.createConnection(option, function () {
    /*
        console.log('Connection name : ' + connName);
        console.log('Connection local address : ' + client.localAddress + ":" + client.localPort);
        console.log('Connection remote address : ' + client.remoteAddress + ":" + client.remotePort);
    */
    });

    //client.setTimeout(1000);
    client.setEncoding('utf8');

    // When server sent back data.
    client.on('data', function (data) {
        if(data.substr(0,5) == 'GRANT')
        {
            data = data.substr(5)
            if (data == 'Failed')
                console.log('Access Grant Failed!')
            else {
                if (data.substr(0,4) == 'key=') {
                    key_end = data.indexOf("token=")
                    sidekey = data.substring("key=".length,key_end)
                    data = data.substring(key_end + "token=".length)
                    store_side_key(sidekey, JSON.parse(data)["id"]) 
                }
                var cap_token = JSON.parse(data)
                console.log('Access Token received for ' + cap_token["subject"])
                store_cap_token(cap_token)
            }
        }
        if(data.substr(0,3) == 'GET')
        {
            data = data.substr(3)
            console.log(data);
        }
        if(data.substr(0,6) == 'UPDATE')
        {
            data = data.substr(6)
            console.log(data);
        }
        if(data.substr(0,8) == 'DELEGATE')
        {
            data = data.substr(8)
            if (data.substr(6) == 'Failed')
                console.log('Access Delegate Failed!')
            else {
                if (data.substr(0,4) == 'key=') {
                    key_end = data.indexOf("token=")
                    sidekey = data.substring("key=".length,key_end)
                    data = data.substring(key_end + "token=".length)
                    store_side_key(sidekey, JSON.parse(data)["id"])
                }
                var cap_token = JSON.parse(data)
                console.log('Delegated Access Token received for ' + cap_token["subject"])
                store_cap_token(cap_token)
            }
        }
        exit_condition = 1
    });

    // When connection disconnected.
    client.on('end',function () {
        console.log('Client socket disconnect. ');
    });

    client.on('timeout', function () {
        //console.log('Client connection timeout. ');
    });

    client.on('error', function (err) {
        console.error(JSON.stringify(err));
    });

    return client;
}

function grantaccess()
{
    var issuer = process.argv[4]
    var subject = process.argv[5]

    var file = process.argv[6]
    var contents = fs.readFileSync(file, 'utf8');
    var data = JSON.parse(contents)
    data["issuer"] = issuer
    data["subject"] = subject

    contents = JSON.stringify(data)

    // Create node client socket.
    var nodeClient = getConn('Node');
    nodeClient.write('GRANT' + contents);
}

function getaccess()
{
    //read the request
    var file = process.argv[4]
    var request = fs.readFileSync(file, 'utf8');
    var data = JSON.parse(request)

    //read the cap token
    file = process.argv[5]
    contents = fs.readFileSync(file, 'utf8');
    data = JSON.parse(contents)
 
    // Create node client socket.
    var nodeClient = getConn('Node');
    console.log('Access requested for Capability Token ' + data["id"] + ", Issuer: " + data["issuer"] + ", Subject: " + data["subject"])
    nodeClient.write('GET' + 'request=' + request.trim() + 'token=' + contents.trim());
 
}

function updateaccess()
{
/*
    var file = process.argv[3]

    var contents = fs.readFileSync(path.resolve("./") + "/" + file, 'utf8');
    var data = JSON.parse(contents)
 
    // Create node client socket.
    var nodeClient = getConn('Node');
    console.log('Access Update requested for Capability Token ' + data["id"] + ", Issuer: " + data["issuer"] + ", Subject: " + data["subject"])
    nodeClient.write('UPDATE' + data["id"]);
*/
    var id = process.argv[4]
    var nodeClient = getConn('Node');
    console.log('Access Update requested for Capability Token ' + id)
    nodeClient.write('UPDATE' + id);

}

function delegateaccess()
{
    var file = process.argv[4]
    var contents = fs.readFileSync(file, 'utf8');

    var data = JSON.parse(contents)

    // Create node client socket.
    var nodeClient = getConn('Node');
    nodeClient.write('DELEGATE' + contents);
}


//console.log(process.argv);

var port = process.argv[2] 
var accesstype = process.argv[3]

if (accesstype == 'GRANT')
{
    grantaccess()
}
else if (accesstype == 'GET')
{
    getaccess()
}
else if (accesstype == 'UPDATE')
{
    updateaccess()
}
else if (accesstype == 'DELEGATE')
{
    delegateaccess()
}
else
{
    console.log('Unkonwn access type ' + accesstype)
}

(function wait() {
  if (!exit_condition) setTimeout(wait, 1000);
  else process.exit(0)
})();
