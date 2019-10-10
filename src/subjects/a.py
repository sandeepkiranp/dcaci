import os
os.chdir('subject2')
command = 'node ../access.js 7001 GRANT owner1 subject2 caprequest.json'
os.system(command)
