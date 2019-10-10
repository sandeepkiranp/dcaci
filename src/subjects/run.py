import os
import os.path
import subprocess
import random
import glob
import json
import time
import sys

script_loc = os.path.dirname(os.path.realpath(__file__))
owners_port_start = 7000
subjects_port_start = 9000

MAX_OWNERS = 5
MAX_SUBJECTS = 3
MAX_DEVICES = 10
MAX_RESOURCES = 5

owners_list = []
subjects_list = []
devices_list = []
resources_list = []
rights_list = ['GET', 'POST', 'PUT', 'DELETE']
operations_list = ['GRANT', 'GET', 'DELEGATE']


def generate_grant_request():
    owner_indx = random.randint(0,MAX_OWNERS-1)    
    port = owners_port_start + owner_indx
    owner = 'owner' + str(owner_indx)

    subject_indx = random.randint(0,MAX_SUBJECTS-1)    
    subject = 'subject' + str(subject_indx)

    # Generate a random token request
    json_data = {}
    json_data["isdelegable"] = "yes"
    json_data["devices"] = []

    devices_num = random.randint(1,MAX_DEVICES-1)    
    for i in range(0, devices_num):
        device = {}
        device["device"] = devices_list[random.randint(0,MAX_DEVICES-1)]
        rights = []
        resources_num = random.randint(1,MAX_RESOURCES -1) 
        for i in range(0, resources_num):
            right = {}
            right["resource"] = resources_list[random.randint(0,MAX_RESOURCES-1)]
            right["right"] = rights_list[random.randint(0,len(rights_list) -1)]
            rights.append(right)
        device["rights"] = rights 
        json_data["devices"].append(device) 
            
    os.chdir(script_loc + '/' + subject)
    data = json.dumps(json_data,indent=2)
    f = open("caprequest.json", "w")
    f.write(data)
    f.close()
    command = 'node ../access.js ' + str(port) + ' GRANT ' + owner + ' ' + subject + ' caprequest.json'  
    print command 
    os.system(command)


def generate_get_request():
    subject_indx = random.randint(0,MAX_SUBJECTS-1)
    subject = 'subject' + str(subject_indx)

    os.chdir(script_loc + '/' + subject)
    token_file_list = []
    for file in glob.glob("*.token"):
        id,ext = file.split('.')
        if os.path.isfile(id + '.mamstate'):
            continue
        token_file_list.append(file)
    if not token_file_list:
        return

    token_file = random.choice(token_file_list)
    #print token_file
    if os.stat(token_file).st_size == 0:
        return
    with open(token_file) as f:
        data = json.load(f)

    port = owners_port_start + owners_list.index(data["rootissuer"])
    id = data["id"]
    devices = data["devices"]

    # Generate a data request
    json_data = {}
    device = devices[random.randint(0,len(devices)-1)]
    json_data["device"] = device["device"]
    rights = device["rights"][random.randint(0,len(device["rights"])-1)]
    json_data["rights"] = []
    json_data["rights"].append(rights)

    data = json.dumps(json_data,indent=2)
    f = open("request.json", "w")
    f.write(data)
    f.close()

    command = 'node ../access.js ' + str(port) + ' GET ' + 'request.json ' + token_file
    print command
    os.system(command)

def generate_delegate_request():
    subject_indx = random.randint(0,MAX_SUBJECTS-1)
    subject = 'subject' + str(subject_indx)
    port = subjects_port_start + subjects_list.index(subject)

    os.chdir(script_loc + '/' + subject)
    token_file_list = []
    for file in glob.glob("*.token"):
        id,ext = file.split('.')
        if os.path.isfile(id + '.mamstate'):
            continue
        token_file_list.append(file)
    if not token_file_list:
        return

    token_file = random.choice(token_file_list)
    #print token_file
    if os.stat(token_file).st_size == 0:
        return
    with open(token_file) as f:
        json_data = json.load(f)

    json_data["issuer"] = subject

    while True:
        recepient = 'subject' + str(random.randint(0,MAX_SUBJECTS-1))
        if recepient != subject:
            break
    json_data["subject"] = recepient

    os.chdir(script_loc + '/' + recepient)
    data = json.dumps(json_data,indent=2)
    f = open("delegate.json", "w")
    f.write(data)
    f.close()

    print 'Subject=' + recepient + ' Issuer=' + subject
    command = 'node ../access.js ' + str(port) + ' DELEGATE ' + ' delegate.json'
    print command
    os.system(command)


for i in range(0,MAX_OWNERS):
    owners_list.append('owner' + str(i))

for i in range(0,MAX_SUBJECTS):
    subjects_list.append('subject' + str(i))

for i in range(0,MAX_DEVICES):
    devices_list.append('device' + str(i))

for i in range(0,MAX_RESOURCES):
    resources_list.append('resource' + str(i))

operation = operations_list[random.randint(0,len(operations_list)-1)]
operation = 'GET'
if operation == 'GRANT':
    generate_grant_request()
elif operation == 'GET':
    generate_get_request()
elif operation == 'DELEGATE':
    generate_delegate_request()

