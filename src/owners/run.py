import os
import subprocess
import random
import glob
import json
import time
from shutil import copyfile
from signal import signal, SIGPIPE, SIG_DFL
signal(SIGPIPE, SIG_DFL)
status_list = ['ACTIVE', 'STANDBY', 'REVOKED', 'SUSPENDED']
script_loc = os.path.dirname(os.path.realpath(__file__))
port_start = 7000
MAX_OWNERS = 5
'''
print 'killing existing instances of server.js'
subprocess.Popen("pkill node" ,shell=True, stdout=subprocess.PIPE)
time.sleep(2)

for x in range(MAX_OWNERS):
    try:
        serverdir = script_loc + '/owner' + str(x)
        server = serverdir + '/server.js'
        os.mkdir(serverdir)
        #os.symlink(script_loc + '/server.js', server)
        # Generate a SEED for owner
        os.system("cat /dev/urandom |tr -dc A-Z9|head -c${1:-81} > ./seed")
        os.rename('./seed', serverdir + '/seed')
    except:
        pass
    # start server.js in background with port
    command = "node server.js owner%s %s" % (x, port_start + x)
    print command
    subprocess.Popen(command ,shell=True, stdout=subprocess.PIPE)
time.sleep(10)
'''
while True:
    time.sleep(10)
    print 'trying update again...'
    owner_indx = random.randint(0,MAX_OWNERS-1)
    owner_indx = 4
    os.chdir(script_loc + '/owner' + str(owner_indx))
    token_file_list = []
    for file in glob.glob("*.token"):
        token_file_list.append(file)
    if not token_file_list:
        continue    

    token_file = random.choice(token_file_list)
    print token_file
    if os.stat(token_file).st_size == 0:
        continue
    with open(token_file) as f:
        data = json.load(f)
    data["status"] = random.choice(status_list)
    token_id = data["id"]
    #print data
    f = open("tmp.json", "w")
    f.write(json.dumps(data,indent=2))
    f.close()
    os.rename('tmp.json', token_file)
    print "running update on owner%s %s, changed status to %s" % (owner_indx, token_file, data["status"])
    command = "node ../access.js %s UPDATE %s" % (port_start + owner_indx, token_id)
    print command
    subprocess.Popen(command ,shell=True, stdout=subprocess.PIPE)
