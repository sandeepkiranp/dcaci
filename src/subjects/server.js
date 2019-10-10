// Import net module.
var net = require('net');
var fs = require('fs');
var crypto = require('crypto')
var util = require('util');

const Mam = require('mam.client.js')
const { asciiToTrytes, trytesToAscii } = require('mam.client.js/node_modules/@iota/converter')

var SEED
var MAM_INITIALIZED = 0
//const IOTA_NODE = 'https://nodes.thetangle.org:443'
const IOTA_NODE = 'https://testnet140.tangle.works'
//const IOTA_NODE = 'https://wallet1.iota.town:443'
//const IOTA_NODE = 'https://nodes.devnet.thetangle.org'

var idaddrstore = {}

var mammode = 'RESTRICTED'
var port = 9999

String.prototype.replaceAt=function(index, replacement) {
    return this.substr(0, index) + replacement+ this.substr(index + replacement.length);
}

// Publish to tangle
const publish = async (mode, sidekey, mamState, packet, response_fun, client_conn) => {
    if (mamState && !MAM_INITIALIZED) 
        Mam.init(IOTA_NODE)
        
    if(mamState == null) {
        var new_seed = SEED.replaceAt(SEED.length - packet["id"].length, packet["id"].toUpperCase())
        mamState = Mam.init(IOTA_NODE, new_seed)
        if (mode == 'RESTRICTED') {
            mamState = Mam.changeMode(mamState, 'restricted', sidekey)
        }
    }
    MAM_INITIALIZED = 1
    
    const trytes = asciiToTrytes(JSON.stringify(packet))
    const message = Mam.create(mamState, trytes)

    mamState = message.state
    console.log('=================')
    console.log(JSON.stringify(mamState, null, 4))
    console.log('=================')
    console.log('root --> ' + message.root)
    console.log('address --> ' + message.address)

    // Attach the payload.
    await Mam.attach(message.payload, message.address)
    response_fun(sidekey, mamState, packet, message.root, client_conn) 
}

function randomIntFromInterval(min,max) // min and max included
{
    return Math.floor(Math.random()*(max-min+1)+min);
}

function generate_random_conditions()
{
    numofconds = randomIntFromInterval(1,5) 
    for (var i = 0; i < numofconds; i++) {
    
    }
}
    
function makeid(length) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

const store_cap_token = (data,id) => {
    string_data = JSON.stringify(data, null, 4)
    fs.writeFile(id, string_data, function(err) {
    if(err) {
        return 0;
    }
    });
    console.log("The mamstate file " +  id + " was saved!");
    return 1;
}

function cap_publish(side_key, mamstate, data, address, client_conn)
{
    data["currentaddress"] = address
    ret = store_cap_token(mamstate,data["id"] + '.mamstate')
    ret = store_cap_token(data, data["id"] + '.token')

    output = 'GRANT'
    if (side_key == undefined) { // PUBLIC mode
        output += JSON.stringify(data)
    }
    else { //RESTRICTED mode
       // send the hash of side_key along with cap_token
                var hash = crypto.createHash('sha1').update(side_key).digest('hex');
                output += 'key=' + hash + 'token=' + JSON.stringify(data)
    }
    client_conn.write(output)
}

const create_cap_token = (client_conn, data) => {
    data = JSON.parse(data)

    if(data["issuer"] != owner)
    {
        console.log('Issuer in the request ' + data["issuer"] + ' does not match the owner name ' + owner)
        client_conn.write('GRANT' + 'Failed')
        return
    }
    var curr_date = new Date();
    var to_date = new Date();
    to_date.setDate(curr_date.getDate() + randomIntFromInterval(1, 5)); 
    data["id"] = makeid(10)
    data["rootid"] = data["id"]
    data["rootissuer"] = owner
    data["status"] = "ACTIVE"
    data["notbefore"] = curr_date.toString();
    data["notafter"] = to_date.toString();
    data["mode"] = mammode

    devices = data["devices"]
    devices.forEach(function(device) {
        rights = device["rights"]

        rights.forEach(function(value){
            //value["conditions"] = generate_random_conditions()
            value["conditions"] = "C1,C2,C6"
        });
    });
    data["delegationdepth"] = 10 

    console.log('Access Token ID=' + data["id"] + ' generated for ' + data["subject"])

    var sidekey
    if (mammode == 'RESTRICTED')
        sidekey = makeid(20)

    publish(mammode, sidekey, null, data, cap_publish, client_conn) 
}

function get_side_key(id) 
{
    var contents = fs.readFileSync(id + ".key", 'utf8');
    return contents
}

function publish_delegate(side_key, mamstate, data, address, client_conn)
{
    data["currentaddress"] = address
    ret = store_cap_token(mamstate,data["id"] + '.mamstate')
    ret = store_cap_token(data, data["id"] + '.token')

    output = 'DELEGATE'
    if (side_key == undefined) { // PUBLIC mode
        output += JSON.stringify(data)
    }
    else { //RESTRICTED mode
       // send the hash of side_key along with cap_token
                var hash = crypto.createHash('sha1').update(side_key).digest('hex');
                output += 'key=' + hash + 'token=' + JSON.stringify(data)
    }
    client_conn.write(output)
}

//Delegation is for tokens already received by a subject
const delegate_cap_token = (client_conn, data) => {
    data = JSON.parse(data)
    var curr_date = new Date();
    var parentid = data["id"]
    data["id"] = makeid(10)
    data["parentid"] = parentid
    data["status"] = "ACTIVE"
    data["notbefore"] = curr_date.toString();
    data["parentaddress"] = data["currentaddress"]
    delete data["currentaddress"] //currentaddress will never show up on Tangle.
                                  //It only is present in the token that is distributed
    devices = data["devices"]
    devices.forEach(function(device) {
        rights = device["rights"]

        rights.forEach(function(value){
            //value["conditions"] = generate_random_conditions()
            value["conditions"] = "C1,C2,C6,C9"
        });
    });

    data["delegationdepth"] = data["delegationdepth"] - 1
    if (data["delegationdepth"] < 0)
        return null
    if (data["currentdelegationdepth"])
        data["currentdelegationdepth"] += 1
    else
        data["currentdelegationdepth"] = 1

    var sidekey
    if (data["mode"] == 'RESTRICTED')
        sidekey = get_side_key(parentid)

    console.log('Delegated Access Token ID=' + data["id"] + ' generated for ' + data["subject"])

    publish(data["mode"], sidekey, null, data, publish_delegate, client_conn)
}

function evaluate_cap_token(req, parent_stack)
{
    var request = JSON.parse(req) 

    //working set initialized with root's values
    var length = parent_stack.length
    var devices= parent_stack[length -1].devices
    var delegable = parent_stack[length -1].isdelegable
    var delegation_depth = parent_stack[length -1].delegationdepth
    var notbefore = new Date(parent_stack[length -1].notbefore)
    var notafter = new Date(parent_stack[length -1].notafter)

    for(var i = parent_stack.length - 2; i >= 0; i--)    
    {
        delegation_depth -= 1
        delegable = parent_stack[i].isdelegable

        if (i > 0 && (delegation_depth == 0 || delegable == "no"))
        {
            console.log('either delegation_depth reached 0 or token ' + parent_stack[i]["id"] + ' is not delegable')
            return 0
        }

        curr_notbefore = new Date(parent_stack[i].notbefore)
        curr_notafter = new Date(parent_stack[i].notafter)

        notbefore = (curr_notbefore > notbefore) ? curr_notbefore : notbefore 
        notafter = (curr_notafter < notafter) ? curr_notafter : notafter 

        curr_date = new Date()
        if (curr_date < notbefore || curr_date > notafter)
        {
            console.log('current date is outside limits for token ' + parent_stack[i]["id"])
            return 0
        }

        //from devices, remove the ones not present in parent_stack[i]
        for(var k = devices.length - 1; k >= 0; k--)
        {
            found = 0
            for (var j=0; j < parent_stack[i].devices.length; j++)
            {
                if(devices[k].device == parent_stack[i].devices[j].device)
                {
                    found = 1
                    rights = devices[k].rights
                    for(var l = rights.length - 1; l >= 0; l--)
                    {
                        foundr = 0
                        for (var m=0; m < parent_stack[i].devices[j].rights.length; m++)
                        {
                            if(rights[l].resource == parent_stack[i].devices[j].rights[m].resource &&
                               rights[l].right == parent_stack[i].devices[j].rights[m].right)
                            {
                                rights[l].conditions = rights[l].conditions + parent_stack[i].devices[j].rights[m].conditions
                                foundr = 1
                            }
                        }
                        if (!foundr) // delete from working set
                            rights.splice(l, 1);
                    }
                    // if none of the rights match, mark found as 0
                    if (rights.length == 0)
                        found = 0
                }
            }
            if (!found)
                devices.splice(k, 1);
        }
        
        if(devices.length == 0)
        {
            console.log('devices array empty when reaching token ' + parent_stack[i]["id"])
            return 0
        }
    }

    // we now have a working set. evaluate the request against the working set
    for(i = 0; i < devices.length; i++)
    {
        if(devices[i].device == request.device)
        {
            rights = devices[i].rights

            for (var j=0; j < rights.length; j++)  
            {
                if(rights[j].resource == request.rights[0].resource &&
                   rights[j].right == request.rights[0].right)
                {
                    //evaluate conditions. For now a pass
                    return 1
                }
            }
        }
    }
    console.log('devices or rights not matching the request')
    return 0
}

function get_side_key_chain(rootid, depth)
{
    var sidekeys = []
    var contents = fs.readFileSync(rootid + ".mamstate", 'utf8');
    var mamstate = JSON.parse(contents)

    //extract the sidekey from mamstate file from the rootid
    side_key = mamstate.channel.side_key
    sidekeys.push(side_key)
    while(depth > 0) {
        side_key = crypto.createHash('sha1').update(side_key).digest('hex');
        sidekeys.push(side_key) 
        depth--
    }
    return sidekeys.reverse()
}

async function check_access(client, request, data) {
    remote_data = JSON.parse(data)
    var ret = 1
    var parent_stack = []
    var side_keys = []
    var mode
    var indx = 0
/*
    // if there is no parentaddress check for token in local store
    if (!("parentaddress" in remote_data)) {
        var contents = fs.readFileSync(remote_data["id"] + '.token', 'utf8');
        var local_data = JSON.parse(contents)
        if(local_data.status != "ACTIVE")
            ret = 0
        parent_stack.push(local_data)        
    }
    else
*/
    { //follow the path to root. Start with currentaddress
        if (!MAM_INITIALIZED) {
            Mam.init(IOTA_NODE)
            MAM_INITIALIZED = 1
        }

        //Start from last known address for this CapToken ID
        if (!idaddrstore[remote_data["id"]])
            address = remote_data["currentaddress"] 
        else
            address = idaddrstore[remote_data["id"]]

        parentid = remote_data["id"]
        issuer = remote_data["subject"]
        if (remote_data["mode"] == 'RESTRICTED') {
            side_keys = get_side_key_chain(remote_data["rootid"], remote_data["currentdelegationdepth"])
            mode = remote_data["mode"]
        }
        
        while (address != undefined ) {
            while(1) {
                console.log('address = ' + address + 'sidekey = ' + side_keys[indx])
                if(mode == 'RESTRICTED') 
                    resp = await Mam.fetchSingle(address, 'restricted', side_keys[indx])
                else
                    resp = await Mam.fetchSingle(address, 'public')
                if (!resp)
                    break
                lastresp = resp 
                lastaddr = address
                address = resp.nextRoot
            }

            indx++

            if (lastresp) {
                current_data = JSON.parse(trytesToAscii(lastresp.payload))
                if(current_data.status != "ACTIVE") {
                    console.log('status not ACTIVE for token ' + current_data["id"])
                    ret = 0
                    break;
                }

                //currentid should be same as parentid of previous level
                if (parentid != current_data["id"]) {
                    console.log('parentid=  ' + parentid + ' is not same as currentid = ' + current_data["id"])
                    ret = 0
                    break
                }

                //subject should be same as issuer of previous level
                if (issuer != current_data["subject"]) {
                    console.log('issuer=  ' + issuer + ' is not same as subject = ' + current_data["subject"])
                    ret = 0
                    break
                }
                idaddrstore[current_data["id"]] = lastaddr

                if(!idaddrstore[current_data["parentid"]])
                    address = current_data["parentaddress"]
                else {
                    address = idaddrstore[current_data["parentid"]]
                }

                parentid = current_data["parentid"]
                issuer = current_data["issuer"]
                parent_stack.push(current_data)
            }
            else {
                console.log('check_access failed to fetch data from address ' + address)
                ret = 0
                break;
            }
        } 
    }
    if (ret) {ret = evaluate_cap_token(request, parent_stack)}
    if (ret)
        console.log('Access GET requested for ID=' + remote_data["id"] + ' ... Access Granted!')
    else
        console.log('Access GET requested for ID=' + remote_data["id"] + ' ... Access Rejected!')

    if(ret)
        client.write('GET' + 'Access Granted!');
    else
        client.write('GET' + 'Access Rejected!');
}

function update_publish(side_key, mamstate, data, address, client_conn)
{
    ret = store_cap_token(mamstate,data["id"] + '.mamstate')

    if (ret) {
        console.log('Update Access requested for ID=' + data["id"] + ' ... Access Updated!')
        client_conn.write('UPDATE' + 'Access Updated!')
    }    
    else {
        console.log('Update Access requested for ID=' + data["id"] + ' ... Access Update Rejected!')
        client_conn.write('UPDATE' + 'Access Update Failed!')
    }
}

const update_access = (client_conn,id) => {
    if (!fs.existsSync(id + '.token') || !fs.existsSync(id + '.mamstate')) {
        console.log('Update Access requested for ' + id + 'Error! (token or mamstate) does not exist') 
        return 0
    }
    console.log('Update Access requested for ' + id)
    var contents = fs.readFileSync(id + '.token', 'utf8');
    var remote_data = JSON.parse(contents)

    contents = fs.readFileSync(id + '.mamstate', 'utf8');
    var mamstate_data = JSON.parse(contents)
    
    var sidekey
    publish(remote_data["mode"], sidekey, mamstate_data, remote_data, update_publish, client_conn)
}


//if (process.argv[2])
//    mammode = process.argv[2]

if (process.argv[2])
    owner = process.argv[2]

if (process.argv[3])
    port = process.argv[3]

console.log(__dirname + '/' + owner)
process.chdir(__dirname + '/' + owner)

var log_file = fs.createWriteStream(__dirname + '/' + owner + '/debug.log', {flags : 'a'});
var log_stdout = process.stdout;

console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
//  log_stdout.write(util.format(d) + '\n');
};

SEED = fs.readFileSync('seed', 'utf8');

// Create and return a net.Server object, the function will be invoked when client connect to this server.
var server = net.createServer(function(client) {
    //console.log('Client connect. Client local address : ' + client.localAddress + ':' + client.localPort + '. client remote address : ' + client.remoteAddress + ':' + client.remotePort);
    client.setEncoding('utf-8');

    //client.setTimeout(10000);

    // When receive client data.
    client.on('data', function (data) {
        if(data.substr(0,5) == 'GRANT')
        {
            data = data.substr(5)
            create_cap_token(client, data)
        }
        else if(data.substr(0,3) == 'GET')
        {
            data = data.substr(3)
            req_end = data.indexOf("token=")
            request = data.substring("request=".length,req_end)
            token = data.substring(req_end + "token=".length) 
            check_access(client, request, token)
        }
        else if(data.substr(0,6) == 'UPDATE')
        {
            id = data.substr(6)
            update_access(client, id)
        }     
        else if(data.substr(0,8) == 'DELEGATE')
        {
            data = data.substr(8)
            delegate_cap_token(client, data)
        }

    });

    // When client send data complete.
    client.on('end', function () {
        //console.log('Client disconnect.');

        // Get current connections count.
        server.getConnections(function (err, count) {
            if(!err)
            {
                // Print current connection count in server console.
         //       console.log("There are %d connections now. ", count);
            }else
            {
                console.error(JSON.stringify(err));
            }

        });
    });

    // When client timeout.
    client.on('timeout', function () {
        console.log('Client request time out. ');
    })
});

// Make the server a TCP server listening on port.
server.listen(port, function () {

    // Get server address info.
    var serverInfo = server.address();

    var serverInfoJson = JSON.stringify(serverInfo);

    console.log('TCP server listen on address : ' + serverInfoJson);

    server.on('close', function () {
        console.log('TCP server socket is closed.');
    });

    server.on('error', function (error) {
        console.error(JSON.stringify(error));
    });

});
